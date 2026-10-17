import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ClassList, ClassSummary, Me } from "@app/contracts";
import { pickDue } from "@app/srs";
import type { Repo, StoredReviewItem } from "./types";

/**
 * Implementação de produção.
 * - Escritas usam o service_role (só existe no servidor).
 * - O painel do professor usa o TOKEN DO PRÓPRIO USUÁRIO, então a RLS do banco
 *   também barra o acesso: duas travas independentes.
 */
export class SupabaseRepo implements Repo {
  private readonly admin: SupabaseClient;

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    serviceRoleKey: string,
  ) {
    this.admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private asUser(accessToken: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  async getMe(userId: string): Promise<Me | null> {
    const { data, error } = await this.admin
      .from("profiles")
      .select("id, school_id, role, full_name, kids_mode")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, schoolId: data.school_id, role: data.role, fullName: data.full_name, kidsMode: data.kids_mode };
  }

  async getClassIds(userId: string) {
    const { data, error } = await this.admin.from("class_members").select("class_id").eq("profile_id", userId);
    if (error) throw error;
    return (data ?? []).map((r) => r.class_id as string);
  }

  async getFlagRules(schoolId: string) {
    const { data, error } = await this.admin
      .from("feature_flags")
      .select("key, enabled, school_id, class_id")
      .or(`school_id.is.null,school_id.eq.${schoolId}`);
    if (error) throw error;
    return (data ?? []).map((r) => ({ key: r.key, enabled: r.enabled, schoolId: r.school_id, classId: r.class_id }));
  }

  async getConversationSecondsOnDay(studentId: string, dayKey: string) {
    const { data, error } = await this.admin
      .from("conversation_usage")
      .select("seconds")
      .eq("student_id", studentId)
      .eq("day_key", dayKey);
    if (error) throw error;
    return (data ?? []).reduce((s, r) => s + (r.seconds as number), 0);
  }

  async addConversationUsage(u: { studentId: string; schoolId: string; sessionId: string; dayKey: string; seconds: number }) {
    const { error } = await this.admin.from("conversation_usage").insert({
      student_id: u.studentId,
      school_id: u.schoolId,
      session_id: u.sessionId,
      day_key: u.dayKey,
      seconds: u.seconds,
    });
    if (error) throw error;
  }

  async listReviewItems(studentId: string): Promise<StoredReviewItem[]> {
    const { data, error } = await this.admin.from("review_items").select("*").eq("student_id", studentId);
    if (error) throw error;
    return (data ?? []).map(toReviewItem);
  }

  async getReviewItem(studentId: string, itemId: string) {
    const { data, error } = await this.admin
      .from("review_items")
      .select("*")
      .eq("id", itemId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) throw error;
    return data ? toReviewItem(data) : null;
  }

  async updateReviewItem(item: StoredReviewItem) {
    const { error } = await this.admin
      .from("review_items")
      .update({ half_life_hours: item.halfLifeHours, last_seen_at: item.lastSeenAt.toISOString() })
      .eq("id", item.id)
      .eq("student_id", item.studentId);
    if (error) throw error;
  }

  async addXp(e: { studentId: string; schoolId: string; amount: number; reason: string }) {
    const { error } = await this.admin
      .from("xp_events")
      .insert({ student_id: e.studentId, school_id: e.schoolId, amount: e.amount, reason: e.reason });
    if (error) throw error;
  }

  async hasXpEvent(studentId: string, reason: string) {
    const { count, error } = await this.admin
      .from("xp_events")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("reason", reason);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listClasses(_requester: Me, accessToken: string): Promise<ClassList["classes"]> {
    const db = this.asUser(accessToken); // RLS: professor vê só as turmas dele; coordenação, as da escola
    const { data, error } = await db.from("classes").select("id, name, grade, class_members(member_role)").order("name");
    if (error) throw error;
    return (data ?? []).map((c) => ({
      classId: c.id as string,
      className: c.name as string,
      grade: (c.grade as string | null) ?? null,
      studentCount: ((c.class_members as Array<{ member_role: string }> | null) ?? []).filter(
        (m) => m.member_role === "student",
      ).length,
    }));
  }

  async getClassSummary(classId: string, _requester: Me, accessToken: string): Promise<ClassSummary | null> {
    const db = this.asUser(accessToken); // RLS aplicada
    const { data: cls } = await db.from("classes").select("id, name").eq("id", classId).maybeSingle();
    if (!cls) return null;

    const { data: members, error } = await db
      .from("class_members")
      .select("profile_id, profiles(full_name)")
      .eq("class_id", classId)
      .eq("member_role", "student");
    if (error) throw error;

    const ids = (members ?? []).map((m) => m.profile_id as string);
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [xp, usage, items] = await Promise.all([
      db.from("xp_events").select("student_id, amount, reason, created_at").in("student_id", ids).gte("created_at", since),
      db.from("conversation_usage").select("student_id, seconds").in("student_id", ids).gte("created_at", since),
      db.from("review_items").select("*").in("student_id", ids),
    ]);
    for (const r of [xp, usage, items]) if (r.error) throw r.error;

    const now = new Date();
    return {
      classId: cls.id,
      className: cls.name,
      students: (members ?? []).map((m) => {
        const id = m.profile_id as string;
        const profile = m.profiles as unknown as { full_name: string } | null;
        return {
          studentId: id,
          fullName: profile?.full_name ?? "",
          xpLast7Days: (xp.data ?? []).filter((x) => x.student_id === id).reduce((s, x) => s + x.amount, 0),
          conversationMinutesLast7Days:
            (usage.data ?? []).filter((u) => u.student_id === id).reduce((s, u) => s + u.seconds, 0) / 60,
          itemsDue: pickDue((items.data ?? []).filter((i) => i.student_id === id).map(toReviewItem), now, 1000).length,
          missionsLast7Days: (xp.data ?? []).filter((x) => x.student_id === id && String(x.reason).startsWith("mission:")).length,
          lastActiveAt:
            (xp.data ?? [])
              .filter((x) => x.student_id === id)
              .map((x) => new Date(x.created_at as string).toISOString())
              .sort()
              .at(-1) ?? null,
        };
      }),
    };
  }

  async audit(e: { actorId: string; schoolId: string; action: string; details?: Record<string, unknown> }) {
    const { error } = await this.admin
      .from("audit_log")
      .insert({ actor_id: e.actorId, school_id: e.schoolId, action: e.action, details: e.details ?? {} });
    if (error) throw error;
  }
}

function toReviewItem(r: Record<string, any>): StoredReviewItem {
  return {
    id: r.id,
    studentId: r.student_id,
    schoolId: r.school_id,
    term: r.term,
    translationPt: r.translation_pt,
    halfLifeHours: Number(r.half_life_hours),
    lastSeenAt: new Date(r.last_seen_at),
  };
}

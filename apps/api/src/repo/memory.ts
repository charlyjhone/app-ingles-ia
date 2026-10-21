import type { ClassList, ClassSummary, Me } from "@app/contracts";
import type { FlagRule } from "@app/flags";
import { pickDue } from "@app/srs";
import type { Repo, StoredReviewItem } from "./types";

/** Repositório em memória: usado nos testes e para rodar a API sem banco. */
export class InMemoryRepo implements Repo {
  users = new Map<string, Me>();
  classes = new Map<
    string,
    { id: string; schoolId: string; name: string; grade?: string | null; teacherIds: string[]; studentIds: string[] }
  >();
  flags: FlagRule[] = [];
  usage: Array<{ studentId: string; dayKey: string; seconds: number; sessionId: string }> = [];
  reviewItems = new Map<string, StoredReviewItem>();
  xp: Array<{ studentId: string; amount: number; reason: string; at: Date }> = [];
  auditLog: Array<{ actorId: string; action: string }> = [];
  /** relógio dos registros (nos testes, o mesmo relógio falso do app) */
  clock: () => Date = () => new Date();

  async getMe(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async getClassIds(userId: string) {
    return [...this.classes.values()]
      .filter((c) => c.studentIds.includes(userId) || c.teacherIds.includes(userId))
      .map((c) => c.id);
  }
  async getFlagRules(schoolId: string) {
    return this.flags.filter((f) => !f.schoolId || f.schoolId === schoolId);
  }
  async getConversationSecondsOnDay(studentId: string, dayKey: string) {
    return this.usage.filter((u) => u.studentId === studentId && u.dayKey === dayKey).reduce((s, u) => s + u.seconds, 0);
  }
  async addConversationUsage(u: { studentId: string; sessionId: string; dayKey: string; seconds: number }) {
    this.usage.push(u);
  }
  async listReviewItems(studentId: string) {
    return [...this.reviewItems.values()].filter((i) => i.studentId === studentId);
  }
  async getReviewItem(studentId: string, itemId: string) {
    const item = this.reviewItems.get(itemId);
    return item && item.studentId === studentId ? item : null;
  }
  async updateReviewItem(item: StoredReviewItem) {
    this.reviewItems.set(item.id, item);
  }
  async addReviewItem(item: Omit<StoredReviewItem, "id">) {
    const id = crypto.randomUUID();
    this.reviewItems.set(id, { ...item, id });
  }
  async addXp(e: { studentId: string; amount: number; reason: string }) {
    this.xp.push({ ...e, at: this.clock() });
  }
  async listXpSince(studentId: string, since: Date) {
    return this.xp.filter((x) => x.studentId === studentId && x.at >= since).map((x) => ({ amount: x.amount, at: x.at }));
  }
  async hasXpEvent(studentId: string, reason: string) {
    return this.xp.some((x) => x.studentId === studentId && x.reason === reason);
  }
  private canSee(c: { schoolId: string; teacherIds: string[] }, requester: Me) {
    if (c.schoolId !== requester.schoolId) return false;
    const isManager = requester.role === "coordinator" || requester.role === "admin";
    return isManager || c.teacherIds.includes(requester.id);
  }
  async listClasses(requester: Me): Promise<ClassList["classes"]> {
    return [...this.classes.values()]
      .filter((c) => this.canSee(c, requester))
      .map((c) => ({ classId: c.id, className: c.name, grade: c.grade ?? null, studentCount: c.studentIds.length }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }
  async getClassSummary(classId: string, requester: Me): Promise<ClassSummary | null> {
    const c = this.classes.get(classId);
    if (!c || !this.canSee(c, requester)) return null;

    const now = new Date();
    const weekAgo = now.getTime() - 7 * 86_400_000;
    return {
      classId: c.id,
      className: c.name,
      students: await Promise.all(
        c.studentIds.map(async (id) => ({
          studentId: id,
          fullName: this.users.get(id)?.fullName ?? "",
          xpLast7Days: this.xp.filter((x) => x.studentId === id && x.at.getTime() >= weekAgo).reduce((s, x) => s + x.amount, 0),
          conversationMinutesLast7Days: this.usage.filter((u) => u.studentId === id).reduce((s, u) => s + u.seconds, 0) / 60,
          itemsDue: pickDue(await this.listReviewItems(id), now, 1000).length,
          missionsLast7Days: this.xp.filter(
            (x) => x.studentId === id && x.reason.startsWith("mission:") && x.at.getTime() >= weekAgo,
          ).length,
          guardianConsentAt: this.users.get(id)?.guardianConsentAt ?? null,
          lastActiveAt: lastAt(this.xp.filter((x) => x.studentId === id).map((x) => x.at)),
        })),
      ),
    };
  }
  logins = new Map<string, string>(); // login → id (só para testes)
  async findOrCreateClass(e: { schoolId: string; name: string; grade?: string }) {
    const found = [...this.classes.values()].find(
      (c) => c.schoolId === e.schoolId && c.name.toLowerCase() === e.name.toLowerCase(),
    );
    if (found) return { id: found.id, created: false };
    const id = crypto.randomUUID();
    this.classes.set(id, { id, schoolId: e.schoolId, name: e.name, grade: e.grade ?? null, teacherIds: [], studentIds: [] });
    return { id, created: true };
  }
  async createStudentAccount(e: { schoolId: string; fullName: string; kidsMode: boolean; login: string; password: string }) {
    if (this.logins.has(e.login)) throw new Error("login já existe");
    const id = crypto.randomUUID();
    this.logins.set(e.login, id);
    this.users.set(id, { id, schoolId: e.schoolId, role: "student", fullName: e.fullName, kidsMode: e.kidsMode });
    return id;
  }
  async addClassMember(e: { classId: string; profileId: string; role: "student" | "teacher" }) {
    const c = this.classes.get(e.classId);
    if (!c) throw new Error("turma não existe");
    const list = e.role === "student" ? c.studentIds : c.teacherIds;
    if (!list.includes(e.profileId)) list.push(e.profileId);
  }
  async setGuardianConsent(e: { studentId: string; schoolId: string; byId: string; at: Date | null }) {
    const u = this.users.get(e.studentId);
    if (!u || u.schoolId !== e.schoolId || u.role !== "student") return false;
    this.users.set(e.studentId, { ...u, guardianConsentAt: e.at ? e.at.toISOString() : null });
    return true;
  }
  async audit(e: { actorId: string; action: string }) {
    this.auditLog.push(e);
  }
}

function lastAt(dates: Date[]): string | null {
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
}

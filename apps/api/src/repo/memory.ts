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
  async addXp(e: { studentId: string; amount: number; reason: string }) {
    this.xp.push({ ...e, at: new Date() });
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
          lastActiveAt: lastAt(this.xp.filter((x) => x.studentId === id).map((x) => x.at)),
        })),
      ),
    };
  }
  async audit(e: { actorId: string; action: string }) {
    this.auditLog.push(e);
  }
}

function lastAt(dates: Date[]): string | null {
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
}

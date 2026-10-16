import type { ClassSummary, Me } from "@app/contracts";
import type { FlagRule } from "@app/flags";
import { pickDue } from "@app/srs";
import type { Repo, StoredReviewItem } from "./types";

/** Repositório em memória: usado nos testes e para rodar a API sem banco. */
export class InMemoryRepo implements Repo {
  users = new Map<string, Me>();
  classes = new Map<string, { id: string; schoolId: string; name: string; teacherIds: string[]; studentIds: string[] }>();
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
  async getClassSummary(classId: string, requester: Me): Promise<ClassSummary | null> {
    const c = this.classes.get(classId);
    if (!c || c.schoolId !== requester.schoolId) return null;
    const isTeacher = c.teacherIds.includes(requester.id);
    const isManager = requester.role === "coordinator" || requester.role === "admin";
    if (!isTeacher && !isManager) return null;

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
        })),
      ),
    };
  }
  async audit(e: { actorId: string; action: string }) {
    this.auditLog.push(e);
  }
}

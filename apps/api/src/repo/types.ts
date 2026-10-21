import type { ClassList, ClassSummary, Me } from "@app/contracts";
import type { FlagRule } from "@app/flags";

export interface StoredReviewItem {
  id: string;
  studentId: string;
  schoolId: string;
  term: string;
  translationPt: string;
  halfLifeHours: number;
  lastSeenAt: Date;
}

/**
 * Toda leitura/escrita do backend passa por aqui.
 * Implementações: InMemoryRepo (testes e dev) e SupabaseRepo (produção).
 * As rotas nunca falam com o banco diretamente — trocar a implementação
 * não muda nenhuma rota.
 */
export interface Repo {
  getMe(userId: string): Promise<Me | null>;
  getClassIds(userId: string): Promise<string[]>;
  getFlagRules(schoolId: string): Promise<FlagRule[]>;

  getConversationSecondsOnDay(studentId: string, dayKey: string): Promise<number>;
  addConversationUsage(u: { studentId: string; schoolId: string; sessionId: string; dayKey: string; seconds: number }): Promise<void>;

  listReviewItems(studentId: string): Promise<StoredReviewItem[]>;
  getReviewItem(studentId: string, itemId: string): Promise<StoredReviewItem | null>;
  updateReviewItem(item: StoredReviewItem): Promise<void>;
  addReviewItem(item: Omit<StoredReviewItem, "id">): Promise<void>;

  addXp(e: { studentId: string; schoolId: string; amount: number; reason: string }): Promise<void>;
  /** Pontos do aluno a partir de uma data (para sequência de dias e meta diária). */
  listXpSince(studentId: string, since: Date): Promise<Array<{ amount: number; at: Date }>>;
  /** Já existe ponto com este motivo? (evita pagar a mesma missão duas vezes) */
  hasXpEvent(studentId: string, reason: string): Promise<boolean>;

  /** Turmas visíveis ao solicitante (professor: as dele; coordenação: todas da escola). */
  listClasses(requester: Me, accessToken: string): Promise<ClassList["classes"]>;
  /** Devolve null se o solicitante NÃO pode ver a turma (o banco também barra via RLS). */
  getClassSummary(classId: string, requester: Me, accessToken: string): Promise<ClassSummary | null>;

  /** Importação: acha a turma pelo nome na escola ou cria. */
  findOrCreateClass(e: { schoolId: string; name: string; grade?: string }): Promise<{ id: string; created: boolean }>;
  /** Importação: cria o login do aluno e o perfil na escola. Lança erro se o login já existe. */
  createStudentAccount(e: { schoolId: string; fullName: string; kidsMode: boolean; login: string; password: string }): Promise<string>;
  addClassMember(e: { classId: string; profileId: string; role: "student" | "teacher" }): Promise<void>;

  /** Grava/retira a autorização do responsável. false = aluno não existe nesta escola. */
  setGuardianConsent(e: { studentId: string; schoolId: string; byId: string; at: Date | null }): Promise<boolean>;

  audit(e: { actorId: string; schoolId: string; action: string; details?: Record<string, unknown> }): Promise<void>;
}

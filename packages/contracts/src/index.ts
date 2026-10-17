/**
 * Contratos compartilhados entre apps, painel e backend.
 *
 * REGRA DE OURO: este arquivo é a "fronteira" entre as partes do produto.
 * - Pode ADICIONAR campos opcionais à vontade.
 * - NÃO remova nem renomeie campos de uma versão publicada (v1).
 *   Para mudanças que quebram, crie um schema novo (ex.: ConversationTurnRequestV2)
 *   e uma rota /v2, mantendo a /v1 viva até todos os apps atualizarem.
 */
import { z } from "zod";
import { Level } from "./scenarios";

export * from "./scenarios";

export const API_VERSION = "v1" as const;

export const Role = z.enum(["student", "guardian", "teacher", "coordinator", "admin"]);
export type Role = z.infer<typeof Role>;

export const AppVariant = z.enum(["student", "kids"]);
export type AppVariant = z.infer<typeof AppVariant>;

export const Me = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  role: Role,
  fullName: z.string(),
  kidsMode: z.boolean(),
});
export type Me = z.infer<typeof Me>;

/* ---------- Conversa com IA ---------- */

/** Áudio de voz natural gerado no servidor (mp3 em base64). */
export const SpeechAudio = z.object({
  mime: z.string(),
  base64: z.string().max(4_000_000),
});
export type SpeechAudio = z.infer<typeof SpeechAudio>;

export const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(2000),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ConversationTurnRequest = z.object({
  sessionId: z.string().uuid(),
  scenario: z.string().min(1).max(80),
  history: z.array(ChatMessage).max(30),
  userText: z.string().min(1).max(1000),
  /** segundos de fala gastos neste turno (para controle de custo) */
  spokenSeconds: z.number().int().min(0).max(600).default(0),
  /** nível escolhido pelo aluno (adicionado depois da v1: opcional, padrão iniciante) */
  level: Level.default("beginner"),
  /** pedir a fala do tutor em áudio de voz natural (opcional; padrão: não) */
  wantAudio: z.boolean().default(false),
});
export type ConversationTurnRequest = z.infer<typeof ConversationTurnRequest>;

export const Correction = z.object({
  original: z.string(),
  suggestion: z.string(),
  explanationPt: z.string(),
});
export type Correction = z.infer<typeof Correction>;

export const ConversationTurnResponse = z.object({
  replyText: z.string(),
  corrections: z.array(Correction),
  minutesUsedToday: z.number(),
  minutesLimitToday: z.number(),
  promptVersion: z.string(),
  /** adicionados depois da v1 (opcionais): missão do cenário cumprida e pontos ganhos neste turno */
  missionCompleted: z.boolean().optional(),
  xpAwarded: z.number().int().optional(),
  /** fala do tutor em voz natural; ausente = o app usa a voz do aparelho */
  replyAudio: SpeechAudio.optional(),
});
export type ConversationTurnResponse = z.infer<typeof ConversationTurnResponse>;

/** Áudio da primeira fala do cenário (o texto vem do catálogo, nunca do aparelho). */
export const SpeechOpenerRequest = z.object({
  scenario: z.string().min(1).max(80),
  level: Level.default("beginner"),
});
export type SpeechOpenerRequest = z.input<typeof SpeechOpenerRequest>;

export const SpeechOpenerResponse = z.object({ audio: SpeechAudio.nullable() });
export type SpeechOpenerResponse = z.infer<typeof SpeechOpenerResponse>;

/* ---------- Revisão espaçada ---------- */

export const ReviewItem = z.object({
  id: z.string().uuid(),
  term: z.string(),
  translationPt: z.string(),
  halfLifeHours: z.number().positive(),
  lastSeenAt: z.string().datetime(),
  recallProbability: z.number().min(0).max(1),
});
export type ReviewItem = z.infer<typeof ReviewItem>;

export const ReviewAnswerRequest = z.object({
  itemId: z.string().uuid(),
  correct: z.boolean(),
});
export type ReviewAnswerRequest = z.infer<typeof ReviewAnswerRequest>;

export const ReviewNextResponse = z.object({ items: z.array(ReviewItem) });
export type ReviewNextResponse = z.infer<typeof ReviewNextResponse>;

export const ReviewAnswerResponse = z.object({ halfLifeHours: z.number() });
export type ReviewAnswerResponse = z.infer<typeof ReviewAnswerResponse>;

/* ---------- Painel do professor ---------- */

export const ClassSummary = z.object({
  classId: z.string().uuid(),
  className: z.string(),
  students: z.array(
    z.object({
      studentId: z.string().uuid(),
      fullName: z.string(),
      xpLast7Days: z.number().int(),
      conversationMinutesLast7Days: z.number(),
      itemsDue: z.number().int(),
      /** adicionados depois da v1 (opcionais) */
      missionsLast7Days: z.number().int().optional(),
      lastActiveAt: z.string().datetime().nullable().optional(),
    }),
  ),
});
export type ClassSummary = z.infer<typeof ClassSummary>;

/** Turmas que o professor (ou a coordenação) pode ver. */
export const ClassList = z.object({
  classes: z.array(
    z.object({
      classId: z.string().uuid(),
      className: z.string(),
      grade: z.string().nullable(),
      studentCount: z.number().int(),
    }),
  ),
});
export type ClassList = z.infer<typeof ClassList>;

/* ---------- Erros padronizados ---------- */

export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      "unauthorized",
      "forbidden",
      "not_found",
      "invalid_request",
      "quota_exceeded",
      "feature_disabled",
      "content_blocked",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

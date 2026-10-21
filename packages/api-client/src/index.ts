/**
 * Cliente único da API, usado pelo app do aluno, app infantil e painel web.
 * Toda resposta é VALIDADA contra o contrato: se backend e app saírem de
 * sincronia, o erro aparece claro (e no monitoramento), em vez de tela quebrada.
 */
import type { z } from "zod";
import {
  ApiError,
  ClassList,
  ClassSummary,
  GuardianConsentResponse,
  ImportStudentsResponse,
  ConversationTurnResponse,
  Me,
  ProgressResponse,
  ReviewAnswerResponse,
  ReviewNextResponse,
  SpeechOpenerResponse,
  type ConversationTurnInput,
  type GuardianConsentRequest,
  type ImportStudentsRequest,
  type SpeechOpenerRequest,
  type SpeechReplyRequest,
  type ReviewAnswerRequest,
} from "@app/contracts";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export function createApiClient({ baseUrl, getAccessToken, fetchImpl = fetch }: ClientOptions) {
  async function request<S extends z.ZodTypeAny>(
    schema: S,
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<z.infer<S>> {
    const token = await getAccessToken();
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiClientError(0, "offline", "Sem conexão com a internet.");
    }

    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = ApiError.safeParse(json);
      throw err.success
        ? new ApiClientError(res.status, err.data.error.code, err.data.error.message)
        : new ApiClientError(res.status, "internal", "Falha de comunicação. Tente novamente.");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiClientError(500, "contract_mismatch", "Resposta fora do contrato da API");
    return parsed.data;
  }

  return {
    me: () => request(Me, "GET", "/me"),
    progress: () => request(ProgressResponse, "GET", "/me/progress"),
    conversationTurn: (body: ConversationTurnInput) =>
      request(ConversationTurnResponse, "POST", "/conversation/turn", body),
    speechReply: (body: SpeechReplyRequest) => request(SpeechOpenerResponse, "POST", "/speech/reply", body),
    speechOpener: (body: SpeechOpenerRequest) => request(SpeechOpenerResponse, "POST", "/speech/opener", body),
    reviewNext: () => request(ReviewNextResponse, "GET", "/review/next"),
    reviewAnswer: (body: ReviewAnswerRequest) => request(ReviewAnswerResponse, "POST", "/review/answer", body),
    setGuardianConsent: (studentId: string, body: GuardianConsentRequest) =>
      request(GuardianConsentResponse, "POST", `/students/${encodeURIComponent(studentId)}/consent`, body),
    importStudents: (body: ImportStudentsRequest) => request(ImportStudentsResponse, "POST", "/import/students", body),
    classes: () => request(ClassList, "GET", "/classes"),
    classSummary: (classId: string) => request(ClassSummary, "GET", `/classes/${encodeURIComponent(classId)}/summary`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

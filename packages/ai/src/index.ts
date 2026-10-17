/**
 * Adaptador de provedores de IA.
 * O resto do produto só conhece a interface `ConversationProvider`.
 * Trocar de provedor (preço, qualidade) = nova classe aqui + variável AI_PROVIDER.
 * Nenhum app, rota ou tela precisa mudar.
 */
import { z } from "zod";
import type { AppVariant, ChatMessage, Correction, Level } from "@app/contracts";
import { CURRENT_PROMPT, type PromptVersion } from "./prompts";
import { SAFE_FALLBACK_REPLY, checkText } from "./safety";

export * from "./prompts";
export * from "./safety";

export interface ProviderRequest {
  system: string;
  history: ChatMessage[];
  userText: string;
}

export interface ConversationProvider {
  readonly name: string;
  complete(req: ProviderRequest): Promise<string>;
}

/* ---------- Provedor falso: testes e desenvolvimento sem custo ---------- */
export class MockProvider implements ConversationProvider {
  readonly name = "mock";
  constructor(private readonly scripted?: (req: ProviderRequest) => string) {}
  async complete(req: ProviderRequest): Promise<string> {
    if (this.scripted) return this.scripted(req);
    return JSON.stringify({ reply: `Nice! You said: "${req.userText}". What else?`, corrections: [] });
  }
}

/* ---------- Anthropic (Claude) via HTTP, sem SDK pesado ---------- */
export class AnthropicProvider implements ConversationProvider {
  readonly name = "anthropic";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 20_000,
  ) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");
  }

  async complete(req: ProviderRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: req.system,
          messages: [
            ...req.history.map((m) => ({ role: m.role, content: m.text })),
            { role: "user", content: req.userText },
          ],
        }),
      });
      if (!res.ok) {
        // Mensagem de erro da Anthropic (ex.: crédito insuficiente, modelo inexistente). Nunca contém a chave.
        const detail = await res.text().catch(() => "");
        throw new Error(`Provedor de IA respondeu ${res.status}: ${detail.slice(0, 300)}`);
      }
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      return data.content?.find((c) => c.type === "text")?.text ?? "";
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createProvider(env: {
  AI_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string | undefined;
  AI_MODEL?: string;
}): ConversationProvider {
  switch (env.AI_PROVIDER ?? "mock") {
    case "anthropic":
      return new AnthropicProvider(env.ANTHROPIC_API_KEY ?? "", env.AI_MODEL ?? "claude-sonnet-5-5");
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`AI_PROVIDER desconhecido: ${env.AI_PROVIDER}`);
  }
}

/* ---------- Serviço de conversa: prompt + segurança + parsing robusto ---------- */

const ModelOutput = z.object({
  reply: z.string().min(1),
  corrections: z
    .array(z.object({ original: z.string(), suggestion: z.string(), explanationPt: z.string() }))
    .default([]),
  missionCompleted: z.boolean().default(false),
});

export interface TutorTurnInput {
  variant: AppVariant;
  scenario: string;
  studentName: string;
  history: ChatMessage[];
  userText: string;
  level?: Level;
  roleEn?: string;
  missionEn?: string | null;
  openerEn?: string;
}

export interface TutorTurnResult {
  replyText: string;
  corrections: Correction[];
  promptVersion: string;
  blocked: boolean;
  missionCompleted: boolean;
}

/** Chamado quando a IA falha, para registrar o motivo nos logs do servidor. */
export type TutorErrorReporter = (stage: "provider" | "parse", detail: string) => void;

export async function tutorTurn(
  provider: ConversationProvider,
  input: TutorTurnInput,
  prompt: PromptVersion = CURRENT_PROMPT,
  onError: TutorErrorReporter = () => {},
): Promise<TutorTurnResult> {
  const fallback = (blocked: boolean): TutorTurnResult => ({
    replyText: SAFE_FALLBACK_REPLY[input.variant],
    corrections: [],
    promptVersion: prompt.id,
    blocked,
    missionCompleted: false,
  });

  const inbound = checkText(input.userText, input.variant);
  if (!inbound.allowed) return fallback(true);

  let raw: string;
  try {
    raw = await provider.complete({
      system: prompt.build(input),
      history: input.history,
      userText: inbound.text,
    });
  } catch (e) {
    // Falha do provedor nunca derruba a aula: o aluno recebe uma fala segura.
    onError("provider", e instanceof Error ? e.message : String(e));
    return fallback(false);
  }

  const parsed = parseModelOutput(raw);
  if (!parsed) {
    onError("parse", raw.slice(0, 300));
    return fallback(false);
  }

  const outbound = checkText(parsed.reply, input.variant);
  if (!outbound.allowed) return fallback(true);

  return {
    replyText: outbound.text,
    corrections: input.variant === "kids" ? [] : parsed.corrections,
    promptVersion: prompt.id,
    blocked: false,
    // Sem missão no cenário, nunca conta como cumprida (mesmo que o modelo diga que sim).
    missionCompleted: Boolean(input.missionEn) && parsed.missionCompleted,
  };
}

function parseModelOutput(raw: string): z.infer<typeof ModelOutput> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const result = ModelOutput.safeParse(JSON.parse(raw.slice(start, end + 1)));
      if (result.success) return result.data;
    } catch {
      /* resposta incompleta: tenta recuperar só a fala abaixo */
    }
  }
  // Resposta cortada no meio: aproveita a fala do tutor (vem primeiro) e descarta as correções.
  const m = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try {
    const reply = JSON.parse(`"${m[1]}"`) as string;
    return reply.trim() ? { reply, corrections: [], missionCompleted: false } : null;
  } catch {
    return null;
  }
}

/**
 * Voz do tutor (texto → fala) gerada no servidor, com voz neural natural.
 * Mesmo padrão do provedor de conversa: o resto do produto só conhece `SpeechProvider`.
 * Trocar de fornecedor (OpenAI, Google, ElevenLabs…) = nova classe aqui + variável TTS_PROVIDER.
 *
 * Só sintetizamos falas produzidas pelo próprio servidor (resposta da IA ou abertura do
 * catálogo): o aparelho nunca envia texto livre para virar áudio.
 */
import type { Level } from "@app/contracts";

export interface SpeechStyle {
  kids: boolean;
  level: Level;
}

export interface SpeechAudio {
  mime: string;
  base64: string;
}

export interface SpeechProvider {
  readonly name: string;
  synthesize(text: string, style: SpeechStyle): Promise<SpeechAudio>;
}

/** Como a voz deve soar: calorosa e humana, mais devagar para crianças e iniciantes. */
export function speechInstructions(style: SpeechStyle): string {
  if (style.kids) {
    return "Voice: a cheerful, warm preschool teacher talking to a small child. Speak slowly and very clearly, smiling, with gentle enthusiasm and natural pauses.";
  }
  const pace = {
    beginner: "Speak slowly and clearly, with short natural pauses between sentences, so a beginner can follow.",
    intermediate: "Speak at a relaxed, natural pace, clearly.",
    advanced: "Speak at a normal conversational pace, like a native speaker.",
  }[style.level];
  return `Voice: a friendly, warm American English teacher having a real conversation. Natural, expressive intonation, never robotic. ${pace}`;
}

export class OpenAiSpeechProvider implements SpeechProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly voices: { student: string; kids: string },
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {
    if (!apiKey) throw new Error("OPENAI_API_KEY ausente");
  }

  async synthesize(text: string, style: SpeechStyle): Promise<SpeechAudio> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          voice: style.kids ? this.voices.kids : this.voices.student,
          input: text.slice(0, 1500),
          instructions: speechInstructions(style),
          response_format: "mp3",
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Provedor de voz respondeu ${res.status}: ${detail.slice(0, 300)}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { mime: "audio/mpeg", base64: Buffer.from(bytes).toString("base64") };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Voz falsa para testes: devolve um "áudio" com o texto, sem custo. */
export class MockSpeechProvider implements SpeechProvider {
  readonly name = "mock";
  calls: Array<{ text: string; style: SpeechStyle }> = [];
  constructor(private readonly fail = false) {}
  async synthesize(text: string, style: SpeechStyle): Promise<SpeechAudio> {
    this.calls.push({ text, style });
    if (this.fail) throw new Error("falha simulada");
    return { mime: "audio/mpeg", base64: Buffer.from(`audio:${text}`).toString("base64") };
  }
}

/** null = sem voz neural configurada: o app usa a voz do próprio aparelho. */
export function createSpeechProvider(env: {
  TTS_PROVIDER?: string;
  OPENAI_API_KEY?: string | undefined;
  TTS_MODEL?: string;
  TTS_VOICE?: string;
  TTS_VOICE_KIDS?: string;
}): SpeechProvider | null {
  switch (env.TTS_PROVIDER ?? "none") {
    case "none":
      return null;
    case "openai":
      return new OpenAiSpeechProvider(env.OPENAI_API_KEY ?? "", env.TTS_MODEL ?? "gpt-4o-mini-tts", {
        student: env.TTS_VOICE ?? "marin",
        kids: env.TTS_VOICE_KIDS ?? "coral",
      });
    default:
      throw new Error(`TTS_PROVIDER desconhecido: ${env.TTS_PROVIDER}`);
  }
}

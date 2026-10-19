import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Level } from "@app/contracts";

/**
 * "Vale" para gerar o áudio de uma fala do tutor DEPOIS de mostrar o texto.
 * O servidor assina a fala que ele mesmo produziu; o aparelho só devolve o vale.
 * Assim ninguém consegue usar o serviço de voz para transformar texto livre em áudio.
 */
export interface SpeechClaim {
  text: string;
  studentId: string;
  kids: boolean;
  level: Level;
  exp: number; // epoch ms
}

const TTL_MS = 10 * 60_000;

export class SpeechTokens {
  private readonly key: Buffer;
  constructor(secret?: string) {
    // Sem segredo configurado: chave aleatória por processo (vales valem só nesta instância).
    this.key = secret ? createHmac("sha256", "speech-token").update(secret).digest() : randomBytes(32);
  }

  issue(c: Omit<SpeechClaim, "exp">, now = Date.now()): string {
    const body = Buffer.from(JSON.stringify({ ...c, exp: now + TTL_MS })).toString("base64url");
    return `${body}.${this.sign(body)}`;
  }

  /** Devolve a fala se o vale é válido, do próprio aluno e não expirou; senão null. */
  verify(token: string, studentId: string, now = Date.now()): SpeechClaim | null {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const c = JSON.parse(Buffer.from(body, "base64url").toString()) as SpeechClaim;
      if (c.studentId !== studentId || typeof c.exp !== "number" || c.exp < now) return null;
      return c;
    } catch {
      return null;
    }
  }

  private sign(body: string) {
    return createHmac("sha256", this.key).update(body).digest("base64url");
  }
}

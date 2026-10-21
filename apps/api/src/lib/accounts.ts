import { randomInt } from "node:crypto";

/** "Ana Júlia Souza" → "ana.souza" (sem acento, só letras) */
export function loginBase(fullName: string): string {
  const parts = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0] ?? "aluno";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return [first, last].filter(Boolean).join(".").slice(0, 40);
}

/** Login único e fácil de digitar: ana.souza.4821@dominio */
export function makeLogin(fullName: string, domain: string): string {
  return `${loginBase(fullName)}.${randomInt(1000, 10000)}@${domain}`;
}

// sem letras/números que se confundem (0/O, 1/l/I)
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Senha provisória de 10 caracteres, gerada com aleatoriedade criptográfica. */
export function makeTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < 10; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

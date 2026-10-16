/**
 * Filtro de conteúdo aplicado na ENTRADA (o que o aluno manda) e na SAÍDA
 * (o que a IA responde). No app infantil o filtro é mais rígido.
 * Esta é a primeira camada; em produção some-se a moderação do provedor.
 */
import type { AppVariant } from "@app/contracts";

const PII_PATTERNS: RegExp[] = [
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, // e-mail
  /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, // telefone BR
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, // CPF
];

const BLOCKED_TERMS_ALL = ["porn", "nude", "nudes", "kill yourself", "suicide method"];
const BLOCKED_TERMS_KIDS = [...BLOCKED_TERMS_ALL, "gun", "blood", "drugs", "sexy", "kiss me"];

export interface SafetyResult {
  allowed: boolean;
  text: string;
  reason?: "blocked_term";
}

/** Remove dados pessoais antes de qualquer texto sair do nosso servidor. */
export function redactPII(text: string): string {
  return PII_PATTERNS.reduce((acc, re) => acc.replace(re, "[removido]"), text);
}

export function checkText(text: string, variant: AppVariant): SafetyResult {
  const lower = text.toLowerCase();
  const terms = variant === "kids" ? BLOCKED_TERMS_KIDS : BLOCKED_TERMS_ALL;
  if (terms.some((t) => lower.includes(t))) {
    return { allowed: false, text: "", reason: "blocked_term" };
  }
  return { allowed: true, text: redactPII(text) };
}

export const SAFE_FALLBACK_REPLY: Record<AppVariant, string> = {
  kids: "Let's play! What color do you like?",
  student: "Let's get back to our conversation. Can you tell me more about your day?",
};

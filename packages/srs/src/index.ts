/**
 * Motor de revisão espaçada — versão simplificada de Half-Life Regression
 * (Settles & Meeder, 2016; modelo público).
 *
 * p(lembrar) = 2^(-Δt / meiaVida)
 * - acerto: a meia-vida cresce (o aluno esquece mais devagar)
 * - erro:   a meia-vida cai (a palavra volta logo para revisão)
 *
 * Funções puras, sem banco e sem rede: fáceis de testar e impossíveis de
 * "quebrar" outras partes do produto.
 */

export const SRS_CONFIG = {
  initialHalfLifeHours: 12,
  minHalfLifeHours: 2,
  maxHalfLifeHours: 24 * 180,
  growthOnCorrect: 2.0,
  shrinkOnWrong: 0.5,
  dueThreshold: 0.5,
} as const;

export interface SrsState {
  halfLifeHours: number;
  lastSeenAt: Date;
}

const HOUR_MS = 3_600_000;

export function recallProbability(state: SrsState, now: Date): number {
  const elapsedHours = Math.max(0, (now.getTime() - state.lastSeenAt.getTime()) / HOUR_MS);
  return Math.pow(2, -elapsedHours / state.halfLifeHours);
}

export function newItem(now: Date): SrsState {
  return { halfLifeHours: SRS_CONFIG.initialHalfLifeHours, lastSeenAt: now };
}

export function applyAnswer(state: SrsState, correct: boolean, now: Date): SrsState {
  const factor = correct ? SRS_CONFIG.growthOnCorrect : SRS_CONFIG.shrinkOnWrong;
  const halfLifeHours = clamp(
    state.halfLifeHours * factor,
    SRS_CONFIG.minHalfLifeHours,
    SRS_CONFIG.maxHalfLifeHours,
  );
  return { halfLifeHours, lastSeenAt: now };
}

/** Itens que precisam de revisão, do mais esquecido para o menos esquecido. */
export function pickDue<T extends SrsState>(items: T[], now: Date, limit = 20): T[] {
  return items
    .map((item) => ({ item, p: recallProbability(item, now) }))
    .filter(({ p }) => p < SRS_CONFIG.dueThreshold)
    .sort((a, b) => a.p - b.p)
    .slice(0, limit)
    .map(({ item }) => item);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

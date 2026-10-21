import { localDayKey } from "./time";

/** Meta diária de pontos (≈ uma conversa curta + uma revisão). */
export const DAILY_GOAL_XP = 30;

const DAY = 86_400_000;

/**
 * Sequência de dias praticando (como o "foguinho" do Duolingo), no fuso da escola.
 * Conta dias seguidos com pelo menos 1 ponto, terminando hoje — ou ontem, se o aluno
 * ainda não praticou hoje (a sequência só quebra depois que o dia acaba).
 */
export function computeProgress(events: Array<{ amount: number; at: Date }>, now: Date, timeZone: string) {
  const byDay = new Map<string, number>();
  for (const e of events) {
    const k = localDayKey(e.at, timeZone);
    byDay.set(k, (byDay.get(k) ?? 0) + e.amount);
  }
  const today = localDayKey(now, timeZone);
  const xpToday = byDay.get(today) ?? 0;

  let streakDays = 0;
  // começa hoje; se hoje está vazio, começa ontem
  let cursor = xpToday > 0 ? now.getTime() : now.getTime() - DAY;
  for (let i = 0; i < 400; i++) {
    if ((byDay.get(localDayKey(new Date(cursor), timeZone)) ?? 0) > 0) {
      streakDays++;
      cursor -= DAY;
    } else break;
  }

  const weekAgo = now.getTime() - 7 * DAY;
  const xpLast7Days = events.filter((e) => e.at.getTime() >= weekAgo).reduce((s, e) => s + e.amount, 0);
  return { streakDays, xpToday, dailyGoal: DAILY_GOAL_XP, goalReached: xpToday >= DAILY_GOAL_XP, xpLast7Days };
}

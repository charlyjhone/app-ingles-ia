import { describe, expect, it } from "vitest";
import { SRS_CONFIG, applyAnswer, newItem, pickDue, recallProbability } from "./index";

const t0 = new Date("2026-10-01T12:00:00Z");
const hoursLater = (h: number) => new Date(t0.getTime() + h * 3_600_000);

describe("revisão espaçada", () => {
  it("probabilidade é 1 logo após estudar e 0,5 depois de uma meia-vida", () => {
    const item = newItem(t0);
    expect(recallProbability(item, t0)).toBe(1);
    expect(recallProbability(item, hoursLater(SRS_CONFIG.initialHalfLifeHours))).toBeCloseTo(0.5);
  });

  it("acerto aumenta e erro diminui a meia-vida, sempre dentro dos limites", () => {
    const item = newItem(t0);
    expect(applyAnswer(item, true, t0).halfLifeHours).toBe(24);
    expect(applyAnswer(item, false, t0).halfLifeHours).toBe(6);

    let s = item;
    for (let i = 0; i < 50; i++) s = applyAnswer(s, false, t0);
    expect(s.halfLifeHours).toBe(SRS_CONFIG.minHalfLifeHours);
    for (let i = 0; i < 50; i++) s = applyAnswer(s, true, t0);
    expect(s.halfLifeHours).toBe(SRS_CONFIG.maxHalfLifeHours);
  });

  it("escolhe primeiro o que o aluno mais esqueceu", () => {
    const items = [
      { id: "recente", halfLifeHours: 12, lastSeenAt: hoursLater(47) },
      { id: "antigo", halfLifeHours: 12, lastSeenAt: t0 },
      { id: "medio", halfLifeHours: 12, lastSeenAt: hoursLater(24) },
    ];
    const due = pickDue(items, hoursLater(48));
    expect(due.map((i) => i.id)).toEqual(["antigo", "medio"]);
  });

  it("relógio adiantado no celular não gera probabilidade > 1", () => {
    const item = newItem(hoursLater(5));
    expect(recallProbability(item, t0)).toBe(1);
  });
});

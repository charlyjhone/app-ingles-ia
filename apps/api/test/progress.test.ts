import { describe, expect, it } from "vitest";
import { computeProgress } from "../src/lib/progress";

const TZ = "America/Sao_Paulo";
// 21/10/2026 às 10h em Macapá (13h UTC)
const NOW = new Date("2026-10-21T13:00:00Z");
const at = (iso: string, amount = 5) => ({ amount, at: new Date(iso) });

describe("sequência de dias", () => {
  it("sem prática: zero", () => {
    expect(computeProgress([], NOW, TZ)).toMatchObject({ streakDays: 0, xpToday: 0, goalReached: false });
  });

  it("conta dias seguidos até hoje", () => {
    const p = computeProgress([at("2026-10-21T12:00:00Z"), at("2026-10-20T15:00:00Z"), at("2026-10-19T20:00:00Z")], NOW, TZ);
    expect(p.streakDays).toBe(3);
    expect(p.xpToday).toBe(5);
  });

  it("ainda não praticou hoje: a sequência de ontem continua viva", () => {
    expect(computeProgress([at("2026-10-20T15:00:00Z"), at("2026-10-19T15:00:00Z")], NOW, TZ).streakDays).toBe(2);
  });

  it("um dia sem praticar quebra a sequência", () => {
    expect(computeProgress([at("2026-10-21T12:00:00Z"), at("2026-10-19T15:00:00Z")], NOW, TZ).streakDays).toBe(1);
  });

  it("usa o fuso da escola: 22h de Macapá ainda é o mesmo dia (já é amanhã em UTC)", () => {
    // 20/10 às 22h30 em Macapá = 21/10 01h30 UTC → conta como dia 20
    const p = computeProgress([at("2026-10-21T01:30:00Z"), at("2026-10-19T15:00:00Z")], NOW, TZ);
    expect(p.streakDays).toBe(2);
    expect(p.xpToday).toBe(0);
  });

  it("meta diária", () => {
    expect(computeProgress([at("2026-10-21T12:00:00Z", 30)], NOW, TZ).goalReached).toBe(true);
  });
});

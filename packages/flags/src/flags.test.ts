import { describe, expect, it } from "vitest";
import { isEnabled, type FlagRule } from "./index";

const COC = "school-coc";
const CONCEITO = "school-conceito";
const TURMA_PILOTO = "class-9a";

describe("feature flags", () => {
  it("usa o padrão do código quando não há regra", () => {
    expect(isEnabled("gamification.class_leagues", [], { schoolId: COC, classIds: [] })).toBe(false);
  });

  it("libera só para a turma piloto", () => {
    const rules: FlagRule[] = [{ key: "gamification.class_leagues", enabled: true, classId: TURMA_PILOTO }];
    expect(isEnabled("gamification.class_leagues", rules, { schoolId: COC, classIds: [TURMA_PILOTO] })).toBe(true);
    expect(isEnabled("gamification.class_leagues", rules, { schoolId: COC, classIds: ["class-8b"] })).toBe(false);
  });

  it("turma vence escola, escola vence global", () => {
    const rules: FlagRule[] = [
      { key: "kids.songs", enabled: false },
      { key: "kids.songs", enabled: true, schoolId: CONCEITO },
      { key: "kids.songs", enabled: false, classId: "class-infantil-2" },
    ];
    expect(isEnabled("kids.songs", rules, { schoolId: COC, classIds: [] })).toBe(false);
    expect(isEnabled("kids.songs", rules, { schoolId: CONCEITO, classIds: [] })).toBe(true);
    expect(isEnabled("kids.songs", rules, { schoolId: CONCEITO, classIds: ["class-infantil-2"] })).toBe(false);
  });
});

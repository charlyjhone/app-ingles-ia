import { describe, expect, it } from "vitest";
import { ConversationTurnRequest, ConversationTurnResponse } from "./index";

/**
 * Testes de compatibilidade: garantem que um app ANTIGO continua sendo aceito.
 * Se alguém tornar obrigatório um campo novo, este teste quebra no CI.
 */
describe("contratos v1 — compatibilidade com apps antigos", () => {
  it("aceita requisição de conversa no formato do primeiro app publicado", () => {
    const legacyPayload = {
      sessionId: "6f1c1d1e-1111-4a4a-8888-000000000001",
      scenario: "restaurant",
      history: [],
      userText: "I want a hamburger, please",
    };
    const parsed = ConversationTurnRequest.parse(legacyPayload);
    expect(parsed.spokenSeconds).toBe(0);
  });

  it("rejeita texto vazio ou gigante", () => {
    const base = { sessionId: "6f1c1d1e-1111-4a4a-8888-000000000001", scenario: "x", history: [] };
    expect(() => ConversationTurnRequest.parse({ ...base, userText: "" })).toThrow();
    expect(() => ConversationTurnRequest.parse({ ...base, userText: "a".repeat(1001) })).toThrow();
  });

  it("resposta continua contendo, obrigatórios, os campos que o app v1 lê", () => {
    const shape = ConversationTurnResponse.shape;
    for (const k of ["corrections", "minutesLimitToday", "minutesUsedToday", "promptVersion", "replyText"] as const) {
      expect(shape[k]).toBeDefined();
      expect(shape[k].isOptional()).toBe(false);
    }
    // Campos novos precisam ser opcionais para não quebrar apps antigos.
    for (const [k, v] of Object.entries(shape)) {
      if (!["corrections", "minutesLimitToday", "minutesUsedToday", "promptVersion", "replyText"].includes(k)) {
        expect(v.isOptional(), `campo novo "${k}" deve ser opcional`).toBe(true);
      }
    }
  });

  it("app antigo sem nível recebe o padrão iniciante", () => {
    const parsed = ConversationTurnRequest.parse({
      sessionId: "6f1c1d1e-1111-4a4a-8888-000000000001",
      scenario: "restaurant",
      history: [],
      userText: "Hi",
    });
    expect(parsed.level).toBe("beginner");
  });
});

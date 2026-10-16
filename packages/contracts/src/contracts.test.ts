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

  it("resposta contém os campos que o app v1 lê", () => {
    const keys = Object.keys(ConversationTurnResponse.shape).sort();
    expect(keys).toEqual(
      ["corrections", "minutesLimitToday", "minutesUsedToday", "promptVersion", "replyText"].sort(),
    );
  });
});

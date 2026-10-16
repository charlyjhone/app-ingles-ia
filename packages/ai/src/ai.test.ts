import { describe, expect, it } from "vitest";
import {
  AnthropicProvider,
  MockProvider,
  PROMPTS,
  SAFE_FALLBACK_REPLY,
  checkText,
  createProvider,
  redactPII,
  tutorTurn,
} from "./index";

const base = { scenario: "restaurant", studentName: "Ana", history: [] };

describe("segurança de conteúdo", () => {
  it("remove e-mail, telefone e CPF", () => {
    const out = redactPII("meu zap é (96) 99123-4567, email ana@gmail.com, cpf 123.456.789-00");
    expect(out).not.toMatch(/99123|ana@gmail|123\.456/);
  });

  it("infantil é mais rígido que o fundamental/médio", () => {
    expect(checkText("I like my toy gun", "kids").allowed).toBe(false);
    expect(checkText("The movie had a gun", "student").allowed).toBe(true);
  });
});

describe("tutorTurn", () => {
  it("devolve resposta e correções do modelo", async () => {
    const provider = new MockProvider(() =>
      JSON.stringify({
        reply: "Great choice!",
        corrections: [{ original: "I want a hamburguer", suggestion: "I'd like a hamburger", explanationPt: "Mais educado" }],
      }),
    );
    const r = await tutorTurn(provider, { ...base, variant: "student", userText: "I want a hamburguer" });
    expect(r.replyText).toBe("Great choice!");
    expect(r.corrections).toHaveLength(1);
    expect(r.promptVersion).toBe("conversation-v1");
  });

  it("modelo devolvendo lixo não quebra a aula", async () => {
    const r = await tutorTurn(new MockProvider(() => "desculpe, erro"), { ...base, variant: "student", userText: "hi" });
    expect(r.replyText).toBe(SAFE_FALLBACK_REPLY.student);
  });

  it("provedor fora do ar não quebra a aula", async () => {
    const failing = { name: "down", complete: async () => { throw new Error("503"); } };
    const r = await tutorTurn(failing, { ...base, variant: "kids", userText: "hello" });
    expect(r.replyText).toBe(SAFE_FALLBACK_REPLY.kids);
  });

  it("resposta imprópria da IA é bloqueada na saída", async () => {
    const provider = new MockProvider(() => JSON.stringify({ reply: "send me nudes", corrections: [] }));
    const r = await tutorTurn(provider, { ...base, variant: "student", userText: "hi" });
    expect(r.blocked).toBe(true);
  });

  it("no infantil não mostra correções formais", async () => {
    const provider = new MockProvider(() =>
      JSON.stringify({ reply: "Yes! A red apple!", corrections: [{ original: "a", suggestion: "b", explanationPt: "c" }] }),
    );
    const r = await tutorTurn(provider, { ...base, variant: "kids", userText: "apple red" });
    expect(r.corrections).toEqual([]);
  });

  it("dados pessoais do aluno não chegam ao provedor", async () => {
    let seen = "";
    const provider = new MockProvider((req) => {
      seen = req.userText;
      return JSON.stringify({ reply: "ok", corrections: [] });
    });
    await tutorTurn(provider, { ...base, variant: "student", userText: "call me 96991234567" });
    expect(seen).not.toContain("96991234567");
  });
});

describe("avaliação dos prompts (roda para toda versão registrada)", () => {
  for (const prompt of Object.values(PROMPTS)) {
    it(`${prompt.id}: contém regras de segurança e formato JSON nas duas versões do app`, () => {
      for (const variant of ["student", "kids"] as const) {
        const text = prompt.build({ ...base, variant });
        expect(text).toMatch(/Nunca peça dados pessoais/);
        expect(text).toMatch(/adulto de confiança/);
        expect(text).toMatch(/"reply"/);
      }
    });
  }
});

describe("seleção de provedor", () => {
  it("mock por padrão e erro claro para provedor desconhecido", () => {
    expect(createProvider({}).name).toBe("mock");
    expect(() => createProvider({ AI_PROVIDER: "xyz" })).toThrow(/desconhecido/);
  });

  it("anthropic exige chave e envia o formato certo", async () => {
    expect(() => new AnthropicProvider("", "m")).toThrow();
    let body: any;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new AnthropicProvider("k", "claude-test", fakeFetch);
    await p.complete({ system: "S", history: [{ role: "assistant", text: "Hi" }], userText: "Hello" });
    expect(body.model).toBe("claude-test");
    expect(body.system).toBe("S");
    expect(body.messages).toEqual([
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Hello" },
    ]);
  });
});

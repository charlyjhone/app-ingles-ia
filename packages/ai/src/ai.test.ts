import { describe, expect, it } from "vitest";
import {
  AnthropicProvider,
  MockProvider,
  PROMPTS,
  PROMPT_V3,
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
    expect(r.promptVersion).toBe("conversation-v4");
  });

  it("resposta cortada no meio (limite de tamanho) ainda aproveita a fala do tutor", async () => {
    const truncated = '{"reply": "Okay, one soda for you. What would you like to eat?", "corrections": [{"original": "How would you like to drink a soda?", "suggestion": "I would like a so';
    const r = await tutorTurn(new MockProvider(() => truncated), { ...base, variant: "student", userText: "a soda" });
    expect(r.replyText).toBe("Okay, one soda for you. What would you like to eat?");
    expect(r.corrections).toEqual([]);
  });

  it("modelo devolvendo lixo não quebra a aula", async () => {
    const r = await tutorTurn(new MockProvider(() => "desculpe, erro"), { ...base, variant: "student", userText: "hi" });
    expect(r.replyText).toBe(SAFE_FALLBACK_REPLY.student);
  });

  it("falhas da IA são reportadas (para aparecer nos logs do servidor)", async () => {
    const reports: string[] = [];
    const failing = { name: "down", complete: async () => { throw new Error("Provedor de IA respondeu 400: credit balance too low"); } };
    await tutorTurn(failing, { ...base, variant: "student", userText: "hi" }, undefined, (stage, d) => reports.push(`${stage}:${d}`));
    await tutorTurn(new MockProvider(() => "texto sem json"), { ...base, variant: "student", userText: "hi" }, undefined, (stage, d) => reports.push(`${stage}:${d}`));
    expect(reports).toEqual(["provider:Provedor de IA respondeu 400: credit balance too low", "parse:texto sem json"]);
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
        if (prompt.id !== "conversation-v1") expect(text).toMatch(/no máximo os 2 erros/);
      }
    });
  }
});

describe("cenários, níveis e missões (v3)", () => {
  const mission = { roleEn: "a friendly waiter at Bella Pizza", missionEn: "order a drink and a dish" };

  it("instruções incluem papel, nível e missão", () => {
    const text = PROMPT_V3.build({ ...base, variant: "student", level: "advanced", ...mission });
    expect(text).toMatch(/a friendly waiter at Bella Pizza/);
    expect(text).toMatch(/AVANÇADO/);
    expect(text).toMatch(/order a drink and a dish/);
    expect(text).toMatch(/missionCompleted/);
  });

  it("missão cumprida é repassada quando o cenário tem missão", async () => {
    const provider = new MockProvider(() => JSON.stringify({ reply: "Enjoy!", corrections: [], missionCompleted: true }));
    const r = await tutorTurn(provider, { ...base, variant: "student", userText: "How much?", ...mission });
    expect(r.missionCompleted).toBe(true);
  });

  it("conversa livre nunca conta missão, mesmo se o modelo disser que sim", async () => {
    const provider = new MockProvider(() => JSON.stringify({ reply: "Cool!", corrections: [], missionCompleted: true }));
    const r = await tutorTurn(provider, { ...base, variant: "student", userText: "Hi", missionEn: null });
    expect(r.missionCompleted).toBe(false);
  });

  it("resposta sem o campo novo (modelo antigo) continua funcionando", async () => {
    const provider = new MockProvider(() => JSON.stringify({ reply: "Hello!", corrections: [] }));
    const r = await tutorTurn(provider, { ...base, variant: "student", userText: "Hi", ...mission });
    expect(r.replyText).toBe("Hello!");
    expect(r.missionCompleted).toBe(false);
  });
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

describe("v4: palavras novas para a revisão", () => {
  const base = { variant: "student" as const, scenario: "No restaurante", studentName: "Ana", history: [], userText: "I want a pizza" };
  const run = (out: object, variant: "student" | "kids" = "student") =>
    tutorTurn(new MockProvider(() => JSON.stringify(out)), { ...base, variant });

  it("é o prompt atual e pede newWords (mas não para crianças)", async () => {
    const { CURRENT_PROMPT, PROMPT_V4 } = await import("./prompts");
    expect(CURRENT_PROMPT.id).toBe("conversation-v4");
    expect(PROMPT_V4.build({ ...base })).toMatch(/newWords/);
    expect(PROMPT_V4.build({ ...base, variant: "kids" })).not.toMatch(/newWords/);
  });

  it("limpa, remove repetidas e longas, e limita a 2", async () => {
    const r = await run({
      reply: "Sure!",
      corrections: [],
      newWords: [
        { term: "  I would like ", translationPt: "eu gostaria" },
        { term: "i would like", translationPt: "repetida" },
        { term: "this is a very long expression indeed", translationPt: "longa demais" },
        { term: "the bill", translationPt: "a conta" },
        { term: "menu", translationPt: "cardápio" },
      ],
    });
    expect(r.newWords).toEqual([
      { term: "I would like", translationPt: "eu gostaria" },
      { term: "the bill", translationPt: "a conta" },
    ]);
  });

  it("formato errado em newWords não derruba a resposta", async () => {
    const r = await run({ reply: "Sure!", corrections: [], newWords: "oops" });
    expect(r.replyText).toBe("Sure!");
    expect(r.newWords).toEqual([]);
  });

  it("criança nunca recebe palavras (não há revisão no app infantil)", async () => {
    const r = await run({ reply: "Yay!", corrections: [], newWords: [{ term: "dog", translationPt: "cachorro" }] }, "kids");
    expect(r.newWords).toEqual([]);
  });
});

describe("privacidade do histórico", () => {
  it("dados pessoais das mensagens anteriores também são removidos antes de ir para a IA", async () => {
    let sent: { history: Array<{ role: string; text: string }> } | null = null;
    const provider = new MockProvider((req) => {
      sent = req;
      return JSON.stringify({ reply: "OK!", corrections: [] });
    });
    await tutorTurn(provider, {
      variant: "student",
      scenario: "x",
      studentName: "Ana",
      userText: "hi",
      history: [
        { role: "user", text: "my email is ana@escola.com and phone (96) 99123-4567" },
        { role: "assistant", text: "Nice!" },
      ],
    });
    expect(sent!.history[0]!.text).not.toMatch(/ana@escola|99123/);
    expect(sent!.history[0]!.text).toMatch(/\[removido\]/);
    expect(sent!.history[1]!.text).toBe("Nice!");
  });
});

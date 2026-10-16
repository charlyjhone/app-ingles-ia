import { describe, expect, it } from "vitest";
import { ApiClientError, createApiClient } from "./index";

const fakeFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const client = (f: typeof fetch) =>
  createApiClient({ baseUrl: "https://api.teste", getAccessToken: async () => "t", fetchImpl: f });

describe("cliente da API", () => {
  it("valida e devolve resposta dentro do contrato", async () => {
    const r = await client(fakeFetch(200, { halfLifeHours: 24 })).reviewAnswer({
      itemId: "33333333-0000-0000-0000-000000000001",
      correct: true,
    });
    expect(r.halfLifeHours).toBe(24);
  });

  it("acusa resposta fora do contrato em vez de quebrar a tela", async () => {
    await expect(client(fakeFetch(200, { items: "errado" })).reviewNext()).rejects.toMatchObject({
      code: "contract_mismatch",
    });
  });

  it("repassa o erro padronizado do servidor", async () => {
    const err = await client(fakeFetch(429, { error: { code: "quota_exceeded", message: "Volte amanhã" } }))
      .me()
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe("quota_exceeded");
  });

  it("sem internet vira erro amigável", async () => {
    const offline = (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    await expect(client(offline).me()).rejects.toMatchObject({ code: "offline" });
  });
});

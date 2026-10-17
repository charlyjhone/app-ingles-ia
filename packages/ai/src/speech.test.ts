import { describe, expect, it, vi } from "vitest";
import { OpenAiSpeechProvider, createSpeechProvider, speechInstructions } from "./speech";

describe("voz neural", () => {
  it("sem configuração, não há voz neural (app usa a do aparelho)", () => {
    expect(createSpeechProvider({})).toBeNull();
    expect(createSpeechProvider({ TTS_PROVIDER: "none" })).toBeNull();
  });

  it("exige a chave quando ligada", () => {
    expect(() => createSpeechProvider({ TTS_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);
  });

  it("instruções: mais lenta para iniciante e criança, natural no avançado", () => {
    expect(speechInstructions({ kids: false, level: "beginner" })).toMatch(/slowly/);
    expect(speechInstructions({ kids: false, level: "advanced" })).toMatch(/native/);
    expect(speechInstructions({ kids: true, level: "advanced" })).toMatch(/child/);
  });

  it("chama a API com a voz certa e devolve mp3 em base64", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const p = new OpenAiSpeechProvider("sk-test", "gpt-4o-mini-tts", { student: "marin", kids: "coral" }, fetchImpl as any);
    const out = await p.synthesize("Hello!", { kids: true, level: "beginner" });
    expect(out).toEqual({ mime: "audio/mpeg", base64: "AQID" });
    const body = JSON.parse((fetchImpl.mock.calls[0] as any)[1].body);
    expect(body).toMatchObject({ model: "gpt-4o-mini-tts", voice: "coral", input: "Hello!", response_format: "mp3" });
  });

  it("erro do fornecedor vira exceção com o motivo (sem a chave)", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    const p = new OpenAiSpeechProvider("sk-secret", "m", { student: "a", kids: "b" }, fetchImpl as any);
    await expect(p.synthesize("Hi", { kids: false, level: "beginner" })).rejects.toThrow(/429: quota/);
    await expect(p.synthesize("Hi", { kids: false, level: "beginner" })).rejects.not.toThrow(/sk-secret/);
  });
});

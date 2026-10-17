import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-speech", () => ({ speak: vi.fn(), stop: vi.fn() }));

const { friendlyListenError, toSpokenSeconds } = await import("./voice");

describe("voz", () => {
  it("converte o tempo de fala para o formato aceito pelo servidor", () => {
    expect(toSpokenSeconds(0)).toBe(0);
    expect(toSpokenSeconds(-5)).toBe(0);
    expect(toSpokenSeconds(300)).toBe(1); // fala muito curta conta 1 segundo
    expect(toSpokenSeconds(4_400)).toBe(4);
    expect(toSpokenSeconds(10 * 60_000)).toBe(600); // nunca passa do limite do contrato
  });

  it("explica em português por que não conseguiu ouvir", () => {
    expect(friendlyListenError("not-allowed")).toMatch(/microfone/);
    expect(friendlyListenError("no-speech")).toMatch(/Não ouvi/);
    expect(friendlyListenError("qualquer")).toMatch(/digite/);
  });
});

describe("speechRate", () => {
  it("mais devagar para crianças e iniciantes", async () => {
    const { speechRate } = await import("./voice");
    expect(speechRate({ kids: true, level: "advanced" })).toBe(0.85);
    expect(speechRate({ level: "beginner" })).toBe(0.85);
    expect(speechRate({ level: "intermediate" })).toBe(0.95);
    expect(speechRate({ level: "advanced" })).toBe(1.0);
  });
});

describe("pickBestVoice", () => {
  it("prefere vozes naturais/neurais em inglês e evita as robóticas", async () => {
    const { pickBestVoice } = await import("./voice");
    const voices = [
      { name: "Fred", lang: "en-US" },
      { name: "Zarvox", lang: "en-US" },
      { name: "Luciana", lang: "pt-BR" },
      { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
      { name: "Google UK English Female", lang: "en-GB" },
    ];
    expect(pickBestVoice(voices)?.name).toMatch(/Aria Online \(Natural\)/);
    expect(pickBestVoice(voices.filter((v) => !/Aria/.test(v.name)))?.name).toBe("Google UK English Female");
    expect(pickBestVoice([{ name: "Luciana", lang: "pt-BR" }])).toBeNull();
  });
});

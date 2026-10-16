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

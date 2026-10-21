import { describe, expect, it } from "vitest";
import { loginBase, makeLogin, makeTemporaryPassword } from "../src/lib/accounts";

describe("logins da importação", () => {
  it("remove acentos e usa primeiro e último nome", () => {
    expect(loginBase("Ana Júlia de Souza")).toBe("ana.souza");
    expect(loginBase("  JOÃO  ")).toBe("joao");
    expect(loginBase("María-José O'Neil")).toBe("maria.neil");
    expect(loginBase("123")).toBe("aluno");
  });
  it("login tem número e domínio", () => {
    expect(makeLogin("Pedro Lima", "x.com")).toMatch(/^pedro\.lima\.\d{4}@x\.com$/);
  });
  it("senha provisória sem caracteres confusos e diferente a cada vez", () => {
    const a = makeTemporaryPassword();
    expect(a).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(a).not.toMatch(/[01OIl]/);
    expect(new Set(Array.from({ length: 50 }, makeTemporaryPassword)).size).toBe(50);
  });
});

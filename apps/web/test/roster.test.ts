import { describe, expect, it } from "vitest";
import { accessesCsv, parseRoster } from "../lib/roster";

describe("lista colada da planilha", () => {
  it("lê colunas separadas por TAB e ignora o cabeçalho", () => {
    const r = parseRoster("Nome\tTurma\tSérie\tInfantil\nAna Souza\t9º A\t9º ano\nLia\tInfantil 2\t\tsim\n");
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { fullName: "Ana Souza", className: "9º A", grade: "9º ano", kidsMode: false },
      { fullName: "Lia", className: "Infantil 2", kidsMode: true },
    ]);
  });

  it("aceita vírgula e ponto e vírgula", () => {
    expect(parseRoster("Pedro Lima;8º B\nJoão, 7º C").rows.map((r) => r.className)).toEqual(["8º B", "7º C"]);
  });

  it("aponta linhas incompletas sem perder as boas", () => {
    const r = parseRoster("Ana\t9º A\nCarlos\n\t9º A");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual(["Linha 2 (Carlos): falta a turma.", "Linha 3: falta o nome do aluno."]);
  });

  it("limite de 200 por vez", () => {
    const text = Array.from({ length: 201 }, (_, i) => `Aluno ${i}\tX`).join("\n");
    expect(parseRoster(text).errors.at(-1)).toMatch(/200/);
  });

  it("CSV de acessos abre no Excel e protege aspas", () => {
    const csv = accessesCsv([{ fullName: 'Ana "Aninha"', className: "9º A", login: "a@x", temporaryPassword: "abc" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Ana ""Aninha""";"9º A";"a@x";"abc"');
  });
});

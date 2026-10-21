/**
 * Lê a lista de alunos colada de uma planilha (Excel/Google Planilhas copiam com TAB),
 * ou digitada com vírgula/ponto e vírgula. Colunas: Nome | Turma | Série (opcional) | Infantil (opcional: sim/não).
 * A primeira linha pode ser o cabeçalho — ele é ignorado.
 */
export interface RosterRow {
  fullName: string;
  className: string;
  grade?: string;
  kidsMode: boolean;
}

export interface RosterParse {
  rows: RosterRow[];
  errors: string[];
}

const YES = new Set(["sim", "s", "x", "yes", "1", "true", "infantil"]);

export function parseRoster(text: string): RosterParse {
  const rows: RosterRow[] = [];
  const errors: string[] = [];
  // só tira espaços do FIM: um TAB no começo significa "coluna Nome vazia"
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[ \r]+$/, "")).filter((l) => l.trim());

  lines.forEach((line, i) => {
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cols = line.split(sep).map((c) => c.trim());
    const [name = "", cls = "", grade = "", kids = ""] = cols;
    if (i === 0 && /^nome/i.test(name)) return; // cabeçalho
    if (name.length < 2) return void errors.push(`Linha ${i + 1}: falta o nome do aluno.`);
    if (!cls) return void errors.push(`Linha ${i + 1} (${name}): falta a turma.`);
    rows.push({
      fullName: name.replace(/\s+/g, " "),
      className: cls.replace(/\s+/g, " "),
      ...(grade ? { grade } : {}),
      kidsMode: YES.has(kids.toLowerCase()),
    });
  });

  if (rows.length > 200) errors.push("No máximo 200 alunos por vez. Divida a planilha em partes.");
  return { rows, errors };
}

/** Planilha (CSV) com os acessos, para baixar e imprimir. Abre certinho no Excel (BOM + ;). */
export function accessesCsv(created: Array<{ fullName: string; className: string; login: string; temporaryPassword: string }>) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["Aluno", "Turma", "Login", "Senha provisória"], ...created.map((c) => [c.fullName, c.className, c.login, c.temporaryPassword])];
  return "﻿" + lines.map((l) => l.map(esc).join(";")).join("\r\n");
}

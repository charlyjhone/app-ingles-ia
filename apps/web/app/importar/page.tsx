"use client";
import { useMemo, useState } from "react";
import type { ImportStudentsResponse } from "@app/contracts";
import { accessesCsv, parseRoster } from "../../lib/roster";

const EXEMPLO = "Nome\tTurma\tSérie\tInfantil\nAna Júlia Souza\t9º A\t9º ano\nPedro Lima\t9º A\t9º ano\nLia Costa\tInfantil 2\t\tsim";

export default function ImportarPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportStudentsResponse | null>(null);
  const parsed = useMemo(() => parseRoster(text), [text]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/importar/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível importar.");
      setResult(json);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([accessesCsv(result.created)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `acessos-alunos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (result) {
    return (
      <section>
        <a href="/" style={{ color: "#2F5BEA", textDecoration: "none" }}>← Suas turmas</a>
        <h1 style={{ fontSize: 24, margin: "8px 0" }}>Importação concluída</h1>
        <p>
          {result.created.length} {result.created.length === 1 ? "aluno criado" : "alunos criados"}
          {result.classesCreated.length > 0 && ` · turmas novas: ${result.classesCreated.join(", ")}`}
        </p>
        <div role="alert" style={{ background: "#FFF4D6", border: "1px solid #F2C94C", borderRadius: 12, padding: 14, margin: "12px 0" }}>
          <strong>Baixe a lista de acessos agora.</strong> As senhas provisórias aparecem só nesta tela: por segurança,
          nem o sistema consegue mostrá-las de novo. Entregue a cada aluno o login e a senha dele.
        </div>
        <button onClick={download} style={primary}>⬇️ Baixar lista de acessos (planilha)</button>
        {result.failed.length > 0 && (
          <div style={{ marginTop: 16, color: "#B00020" }}>
            <strong>Não foram criados:</strong>
            <ul>
              {result.failed.map((f, i) => (
                <li key={i}>
                  {f.fullName}: {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ overflowX: "auto", marginTop: 16, background: "#FFF", borderRadius: 12, border: "1px solid #E5E5E0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DDD" }}>
                <th style={cell}>Aluno</th>
                <th style={cell}>Turma</th>
                <th style={cell}>Login</th>
                <th style={cell}>Senha provisória</th>
              </tr>
            </thead>
            <tbody>
              {result.created.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td style={cell}>{c.fullName}</td>
                  <td style={cell}>{c.className}</td>
                  <td style={{ ...cell, fontFamily: "monospace" }}>{c.login}</td>
                  <td style={{ ...cell, fontFamily: "monospace" }}>{c.temporaryPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setResult(null)} style={{ ...secondary, marginTop: 16 }}>Importar outra lista</button>
      </section>
    );
  }

  return (
    <section>
      <a href="/" style={{ color: "#2F5BEA", textDecoration: "none" }}>← Suas turmas</a>
      <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>Importar alunos</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Copie da sua planilha as colunas <strong>Nome</strong>, <strong>Turma</strong>, <strong>Série</strong> (opcional) e{" "}
        <strong>Infantil</strong> (opcional: “sim” para o app infantil) e cole abaixo. Turmas que não existirem são criadas.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXEMPLO}
        rows={12}
        style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace", fontSize: 14, padding: 12, borderRadius: 10, border: "1px solid #CCC" }}
      />
      {text && (
        <p style={{ color: "#555" }}>
          {parsed.rows.length} {parsed.rows.length === 1 ? "aluno encontrado" : "alunos encontrados"}
          {parsed.rows.length > 0 && ` em ${new Set(parsed.rows.map((r) => r.className)).size} turma(s)`}.
        </p>
      )}
      {parsed.errors.length > 0 && (
        <ul style={{ color: "#B00020" }}>
          {parsed.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" style={{ color: "#B00020" }}>
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy || parsed.rows.length === 0 || parsed.rows.length > 200}
        style={{ ...primary, opacity: busy || parsed.rows.length === 0 ? 0.6 : 1 }}
      >
        {busy ? "Criando acessos…" : `Criar acessos para ${parsed.rows.length} aluno(s)`}
      </button>
    </section>
  );
}

const cell: React.CSSProperties = { padding: "8px 12px" };
const primary: React.CSSProperties = {
  padding: "12px 18px", fontSize: 16, borderRadius: 10, border: 0, background: "#2F5BEA", color: "#FFF", fontWeight: 600, cursor: "pointer",
};
const secondary: React.CSSProperties = { ...primary, background: "#EEF2FF", color: "#2F5BEA" };

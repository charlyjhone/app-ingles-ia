import { ApiClientError } from "@app/api-client";
import { serverApi } from "../lib/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const api = await serverApi();
  let classes;
  let me;
  try {
    [classes, me] = await Promise.all([api.classes().then((r) => r.classes), api.me()]);
  } catch (e) {
    const msg = e instanceof ApiClientError ? e.message : "Não foi possível carregar suas turmas.";
    return <p role="alert">{msg}</p>;
  }

  return (
    <section>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Suas turmas</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Escolha uma turma para ver o progresso dos alunos.</p>
      {(me.role === "coordinator" || me.role === "admin") && (
        <p>
          <a href="/importar" style={{ color: "#2F5BEA", fontWeight: 600 }}>
            ➕ Importar alunos de uma planilha
          </a>
        </p>
      )}
      {classes.length === 0 ? (
        <p style={{ background: "#FFF", padding: 16, borderRadius: 12 }}>
          Nenhuma turma vinculada a você ainda. Peça à coordenação para incluir você em uma turma.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {classes.map((c) => (
            <a
              key={c.classId}
              href={`/turma/${c.classId}`}
              style={{
                background: "#FFF", borderRadius: 14, padding: 18, textDecoration: "none", color: "inherit",
                border: "1px solid #E5E5E0",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600 }}>{c.className}</div>
              <div style={{ color: "#666", marginTop: 4 }}>
                {c.grade ? `${c.grade} · ` : ""}
                {c.studentCount} {c.studentCount === 1 ? "aluno" : "alunos"}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

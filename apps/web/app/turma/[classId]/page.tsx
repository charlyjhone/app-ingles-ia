import { ApiClientError } from "@app/api-client";
import { serverApi } from "../../../lib/server";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function lastActiveLabel(iso: string | null | undefined, now: number) {
  if (!iso) return { text: "Nunca praticou", alert: true };
  const days = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (days <= 0) return { text: "Hoje", alert: false };
  if (days === 1) return { text: "Ontem", alert: false };
  return { text: `Há ${days} dias`, alert: days >= 3 };
}

export default async function TurmaPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { classId } = await params;
  const { erro } = await searchParams;
  const api = await serverApi();

  let summary;
  let me;
  try {
    [summary, me] = await Promise.all([api.classSummary(classId), api.me()]);
  } catch (e) {
    const msg = e instanceof ApiClientError ? e.message : "Não foi possível carregar a turma.";
    return <p role="alert">{msg}</p>;
  }

  const now = Date.now();
  const isManager = me.role === "coordinator" || me.role === "admin";
  const students = [...summary.students].sort((a, b) => b.xpLast7Days - a.xpLast7Days);
  const active = students.filter((s) => !lastActiveLabel(s.lastActiveAt, now).alert).length;
  const missions = students.reduce((n, s) => n + (s.missionsLast7Days ?? 0), 0);
  const minutes = students.reduce((n, s) => n + s.conversationMinutesLast7Days, 0);

  return (
    <section>
      <a href="/" style={{ color: "#2F5BEA", textDecoration: "none" }}>← Suas turmas</a>
      <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>{summary.className}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Últimos 7 dias</p>
      {erro && (
        <p role="alert" style={{ color: "#B00020" }}>
          Não foi possível registrar a autorização. Tente de novo.
        </p>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", margin: "16px 0" }}>
        <Stat label="Alunos ativos" value={`${active} de ${students.length}`} />
        <Stat label="Missões cumpridas" value={String(missions)} />
        <Stat label="Minutos de conversa" value={minutes.toFixed(0)} />
      </div>

      {students.length === 0 ? (
        <p style={{ background: "#FFF", padding: 16, borderRadius: 12 }}>Nenhum aluno nesta turma ainda.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#FFF", borderRadius: 12, border: "1px solid #E5E5E0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #DDD", color: "#555", fontSize: 14 }}>
                <th style={th}>Aluno</th>
                <th style={th}>Pontos</th>
                <th style={th}>Missões</th>
                <th style={th}>Minutos falando</th>
                <th style={th}>Palavras p/ revisar</th>
                <th style={th}>Último acesso</th>
                <th style={th}>Autorização do responsável</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const last = lastActiveLabel(s.lastActiveAt, now);
                return (
                  <tr key={s.studentId} style={{ borderBottom: "1px solid #F0F0F0" }}>
                    <td style={td}>{s.fullName}</td>
                    <td style={td}>{s.xpLast7Days}</td>
                    <td style={td}>{s.missionsLast7Days ?? 0}</td>
                    <td style={td}>{s.conversationMinutesLast7Days.toFixed(1)}</td>
                    <td style={td}>{s.itemsDue}</td>
                    <td style={{ ...td, color: last.alert ? "#B00020" : "inherit", fontWeight: last.alert ? 600 : 400 }}>
                      {last.alert ? "⚠️ " : ""}
                      {last.text}
                    </td>
                    <td style={td}>
                      {s.guardianConsentAt ? (
                        <span title={new Date(s.guardianConsentAt).toLocaleString("pt-BR")}>
                          ✅ Registrada em {new Date(s.guardianConsentAt).toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <span style={{ color: "#8A6D00" }}>Pendente</span>
                      )}
                      {isManager && (
                        <form method="post" action={`/turma/${classId}/autorizacao`} style={{ display: "inline", marginLeft: 8 }}>
                          <input type="hidden" name="studentId" value={s.studentId} />
                          <input type="hidden" name="given" value={s.guardianConsentAt ? "0" : "1"} />
                          <button type="submit" style={linkButton}>
                            {s.guardianConsentAt ? "Retirar" : "Registrar termo assinado"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: "#666", fontSize: 13, marginTop: 12 }}>
        ⚠️ = aluno sem praticar há 3 dias ou mais: vale um incentivo em sala.
        {isManager && (
          <>
            {" "}A autorização só deve ser registrada depois de receber o termo assinado pelo responsável (
            <a href="/termo" style={{ color: "#2F5BEA" }}>modelo do termo para imprimir</a>).
          </>
        )}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#FFF", borderRadius: 12, padding: 16, border: "1px solid #E5E5E0" }}>
      <div style={{ color: "#666", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };
const linkButton: React.CSSProperties = {
  background: "none", border: 0, color: "#2F5BEA", cursor: "pointer", fontSize: 14, padding: 0, textDecoration: "underline",
};

import { ApiClientError } from "@app/api-client";
import { serverApi } from "../../../lib/server";

export const dynamic = "force-dynamic";

export default async function TurmaPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const api = await serverApi();

  let summary;
  try {
    summary = await api.classSummary(classId);
  } catch (e) {
    const msg = e instanceof ApiClientError ? e.message : "Não foi possível carregar a turma.";
    return <p role="alert">{msg}</p>;
  }

  return (
    <section>
      <h1 style={{ fontSize: 22 }}>{summary.className}</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#FFF" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #DDD" }}>
            <th style={{ padding: 8 }}>Aluno</th>
            <th style={{ padding: 8 }}>XP (7 dias)</th>
            <th style={{ padding: 8 }}>Minutos de conversa (7 dias)</th>
            <th style={{ padding: 8 }}>Palavras para revisar</th>
          </tr>
        </thead>
        <tbody>
          {summary.students.map((s) => (
            <tr key={s.studentId} style={{ borderBottom: "1px solid #F0F0F0" }}>
              <td style={{ padding: 8 }}>{s.fullName}</td>
              <td style={{ padding: 8 }}>{s.xpLast7Days}</td>
              <td style={{ padding: 8 }}>{s.conversationMinutesLast7Days.toFixed(1)}</td>
              <td style={{ padding: 8 }}>{s.itemsDue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

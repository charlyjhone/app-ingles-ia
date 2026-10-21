import { NextResponse } from "next/server";
import { serverApi } from "../../../../lib/server";

/** Formulário do painel: coordenação registra ou retira a autorização do responsável. */
export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const form = await req.formData();
  const studentId = String(form.get("studentId") ?? "");
  const given = form.get("given") === "1";
  const api = await serverApi();
  let erro = "";
  try {
    await api.setGuardianConsent(studentId, { given });
  } catch {
    erro = "?erro=autorizacao";
  }
  return NextResponse.redirect(new URL(`/turma/${encodeURIComponent(classId)}${erro}`, req.url), { status: 303 });
}

import { NextResponse } from "next/server";
import { ApiClientError } from "@app/api-client";
import { ImportStudentsRequest } from "@app/contracts";
import { serverApi } from "../../../lib/server";

/** Repassa a importação para a API com a sessão da coordenação (cookie httpOnly). */
export async function POST(req: Request) {
  const parsed = ImportStudentsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lista inválida." }, { status: 400 });
  try {
    const api = await serverApi();
    const result = await api.importStudents(parsed.data);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const msg = e instanceof ApiClientError ? e.message : "Não foi possível importar agora.";
    return NextResponse.json({ error: msg }, { status: e instanceof ApiClientError ? e.status || 500 : 500 });
  }
}

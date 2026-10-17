import "server-only";
import { createApiClient } from "@app/api-client";
import { supabaseServer } from "./supabase-server";

/** Cliente da API no servidor, autenticado com a sessão do professor. */
export async function serverApi() {
  const supabase = await supabaseServer();
  return createApiClient({
    baseUrl: process.env.API_URL ?? "http://localhost:8080",
    getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  });
}

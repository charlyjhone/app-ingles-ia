import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createApiClient } from "@app/api-client";

/** Cliente da API no servidor, autenticado com a sessão do professor (cookie httpOnly). */
export async function serverApi() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* leitura apenas em Server Components */
        },
      },
    },
  );
  return createApiClient({
    baseUrl: process.env.API_URL ?? "http://localhost:8080",
    getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  });
}

import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** Cliente Supabase no servidor com a sessão do professor (cookie httpOnly). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: Array<{ name: string; value: string; options?: CookieOptions }>) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          /* em Server Components os cookies são só leitura; o middleware renova a sessão */
        }
      },
    },
  });
}

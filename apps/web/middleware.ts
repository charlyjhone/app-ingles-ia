import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Toda página do painel exige login. Também renova a sessão (cookie) a cada acesso.
 * Sem sessão → /login.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: Array<{ name: string; value: string; options?: CookieOptions }>) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  if (!data.user && !isLogin) return NextResponse.redirect(new URL("/login", req.url));
  if (data.user && isLogin) return NextResponse.redirect(new URL("/", req.url));
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|health).*)"] };

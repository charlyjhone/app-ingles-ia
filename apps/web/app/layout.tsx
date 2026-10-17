import type { ReactNode } from "react";
import { supabaseServer } from "../lib/supabase-server";

export const metadata = { title: "Painel do Professor — Inglês com IA" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { data } = await (await supabaseServer()).auth.getUser();
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#F7F7F5", color: "#1C1C1C" }}>
        <header
          style={{
            padding: "14px 24px", background: "#FFFFFF", borderBottom: "1px solid #E5E5E0",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
          }}
        >
          <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
            <strong>Inglês com IA</strong> · Painel do professor
          </a>
          {data.user && (
            <form action="/sair" method="post" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ color: "#666", fontSize: 14 }}>{data.user.email}</span>
              <button type="submit" style={{ background: "none", border: 0, color: "#2F5BEA", fontSize: 15, cursor: "pointer" }}>
                Sair
              </button>
            </form>
          )}
        </header>
        <main style={{ padding: "24px 16px", maxWidth: 960, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}

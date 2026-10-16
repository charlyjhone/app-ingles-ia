import type { ReactNode } from "react";

export const metadata = { title: "Painel do Professor — Inglês com IA" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#F7F7F5", color: "#1C1C1C" }}>
        <header style={{ padding: "16px 24px", background: "#FFFFFF", borderBottom: "1px solid #E5E5E0" }}>
          <strong>Inglês com IA</strong> · Painel do professor
        </header>
        <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}

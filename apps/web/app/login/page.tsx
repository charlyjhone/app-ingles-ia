"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <section style={{ maxWidth: 380, margin: "48px auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Entrar no painel</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Acesso para professores e coordenação.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label style={{ display: "grid", gap: 4 }}>
          E-mail
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Senha
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
        </label>
        {error && (
          <p role="alert" style={{ color: "#B00020", margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} style={button}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </section>
  );
}

const input: React.CSSProperties = { padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid #CCC" };
const button: React.CSSProperties = {
  padding: 14, fontSize: 16, borderRadius: 10, border: 0, background: "#2F5BEA", color: "#FFF", fontWeight: 600, cursor: "pointer",
};

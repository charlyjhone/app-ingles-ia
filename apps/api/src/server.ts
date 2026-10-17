import { createProvider, createSpeechProvider } from "@app/ai";
import { buildApp } from "./app";
import { loadEnv, toAppConfig } from "./config";
import { supabaseTokenVerifier } from "./lib/auth";
import { SupabaseRepo } from "./repo/supabase";

const env = loadEnv();

const app = await buildApp({
  repo: new SupabaseRepo(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, env.SUPABASE_SERVICE_ROLE_KEY),
  provider: createProvider(env),
  speech: createSpeechProvider(env),
  verifyToken: supabaseTokenVerifier({ supabaseUrl: env.SUPABASE_URL, jwtSecret: env.SUPABASE_JWT_SECRET }),
  config: toAppConfig(env),
});

// Desligamento gracioso: o Render envia SIGTERM no deploy; terminamos as
// requisições em andamento antes de sair (nenhuma aula é cortada no meio).
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: env.PORT, host: "0.0.0.0" });

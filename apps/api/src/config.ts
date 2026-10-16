import { z } from "zod";

/**
 * Configuração validada na inicialização: se faltar uma variável obrigatória,
 * o servidor NEM SOBE (falha cedo, no deploy, e o Render mantém a versão antiga no ar).
 */
const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-sonnet-5-5"),
  DAILY_CONVERSATION_MINUTES_STUDENT: z.coerce.number().positive().default(15),
  DAILY_CONVERSATION_MINUTES_KIDS: z.coerce.number().positive().default(5),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

export type AppConfig = {
  minutesStudent: number;
  minutesKids: number;
  allowedOrigins: string[];
  timeZone: string;
  version: string;
};

export function loadEnv(raw: NodeJS.ProcessEnv = process.env) {
  const env = Env.parse(raw);
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    throw new Error("AI_PROVIDER=anthropic exige ANTHROPIC_API_KEY");
  }
  return env;
}

export function toAppConfig(env: ReturnType<typeof loadEnv>): AppConfig {
  return {
    minutesStudent: env.DAILY_CONVERSATION_MINUTES_STUDENT,
    minutesKids: env.DAILY_CONVERSATION_MINUTES_KIDS,
    allowedOrigins: env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()),
    timeZone: "America/Sao_Paulo",
    version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "dev",
  };
}

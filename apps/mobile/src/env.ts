import Constants from "expo-constants";
import type { AppVariant } from "@app/contracts";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  variant?: AppVariant;
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const ENV = {
  variant: extra.variant ?? "student",
  apiUrl: extra.apiUrl ?? "http://localhost:8080",
  supabaseUrl: extra.supabaseUrl ?? "",
  // A chave "anon" é pública por definição; a segurança vem da RLS do banco.
  // Chaves secretas (service_role, IA) NUNCA entram no app.
  supabaseAnonKey: extra.supabaseAnonKey ?? "",
} as const;

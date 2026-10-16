import type { ExpoConfig } from "expo/config";

/**
 * Um código, dois apps na loja:
 *   APP_VARIANT=student → app do aluno (fundamental/médio)
 *   APP_VARIANT=kids    → app infantil (2 a 5 anos), filtro mais rígido e sem chat livre
 * Assim uma correção vale para os dois, e nenhum deles fica "esquecido".
 */
const variant = process.env.APP_VARIANT === "kids" ? "kids" : "student";
const isKids = variant === "kids";

const config: ExpoConfig = {
  name: isKids ? "Inglês Kids" : "Inglês com IA",
  slug: isKids ? "ingles-kids" : "ingles-ia",
  scheme: isKids ? "ingleskids" : "inglesia",
  version: "0.1.0",
  orientation: "portrait",
  ios: { bundleIdentifier: isKids ? "br.com.escola.inglesia.kids" : "br.com.escola.inglesia" },
  android: { package: isKids ? "br.com.escola.inglesia.kids" : "br.com.escola.inglesia" },
  plugins: ["expo-router", "expo-secure-store"],
  // Versão para computador (laboratório da escola): o mesmo app, aberto no navegador.
  web: { bundler: "metro", output: "single" },
  // Atualizações sem passar pela loja + volta rápida para a versão anterior.
  runtimeVersion: { policy: "appVersion" },
  updates: { url: "https://u.expo.dev/SEU-PROJECT-ID", fallbackToCacheTimeout: 0 },
  extra: {
    variant,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
};

export default config;

import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@app/api-client";
import { ENV } from "./env";

/**
 * Onde a sessão de login fica guardada:
 * - celular: cofre do sistema (Keychain no iPhone, Keystore no Android);
 * - navegador (laboratório da escola): armazenamento do próprio navegador.
 *   Nos computadores compartilhados, o botão "Sair" apaga a sessão.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const isWeb = Platform.OS === "web";

export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    // No navegador o supabase-js usa o localStorage por padrão.
    ...(isWeb ? {} : { storage: secureStorage }),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isWeb,
  },
});

export const api = createApiClient({
  baseUrl: ENV.apiUrl,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

export const signOut = () => supabase.auth.signOut();

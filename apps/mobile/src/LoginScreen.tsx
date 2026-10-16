import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ENV } from "./env";
import { supabase } from "./services";

/** Mensagens claras em português para os erros mais comuns de login. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Este e-mail ainda não foi confirmado.";
  if (/network|fetch/i.test(message)) return "Sem conexão com a internet.";
  return "Não foi possível entrar. Tente novamente.";
}

export function LoginScreen() {
  const kids = ENV.variant === "kids";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(friendly(err.message));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>{kids ? "Inglês Kids" : "Inglês com IA"}</Text>
        <Text style={styles.subtitle}>
          {kids ? "Peça para um adulto entrar com a conta da escola." : "Entre com a conta fornecida pela escola."}
        </Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          placeholder="aluno@escola.com.br"
          accessibilityLabel="E-mail"
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          secureTextEntry
          autoComplete="current-password"
          placeholder="Sua senha"
          onSubmitEditing={signIn}
          accessibilityLabel="Senha"
        />

        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <Pressable style={styles.button} onPress={signIn} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F2F2F2" },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, gap: 6 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 2 },
  subtitle: { fontSize: 15, color: "#555555", marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "500", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#CCCCCC", borderRadius: 10, padding: 12, fontSize: 16 },
  error: { color: "#B00020", marginTop: 10, fontSize: 14 },
  button: { backgroundColor: "#2F5BEA", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
});

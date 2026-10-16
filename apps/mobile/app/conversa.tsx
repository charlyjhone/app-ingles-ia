import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiClientError } from "@app/api-client";
import type { ChatMessage, Correction } from "@app/contracts";
import { ENV } from "../src/env";
import { api } from "../src/services";

const newId = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

export default function Conversa() {
  const sessionId = useRef(newId()).current;
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    const userText = text.trim();
    if (!userText || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const r = await api.conversationTurn({
        sessionId,
        scenario: ENV.variant === "kids" ? "colors and animals" : "restaurant",
        history: history.slice(-20),
        userText,
        spokenSeconds: 0,
      });
      setHistory((h) => [...h, { role: "user", text: userText }, { role: "assistant", text: r.replyText }]);
      setCorrections(r.corrections);
      setText("");
    } catch (e) {
      setStatus(e instanceof ApiClientError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <Text style={[styles.bubble, item.role === "user" ? styles.user : styles.bot]}>{item.text}</Text>
        )}
      />
      {corrections.map((c, i) => (
        <Text key={i} style={styles.correction}>
          ✏️ {c.suggestion} — {c.explanationPt}
        </Text>
      ))}
      {status && <Text style={styles.status}>{status}</Text>}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type in English…"
          maxLength={1000}
          onSubmitEditing={send}
        />
        <Pressable style={styles.send} onPress={send} disabled={sending} accessibilityRole="button">
          <Text style={styles.sendText}>{sending ? "…" : "Enviar"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  bubble: { padding: 12, borderRadius: 12, marginVertical: 4, maxWidth: "85%", fontSize: 16 },
  user: { alignSelf: "flex-end", backgroundColor: "#DCE6FF" },
  bot: { alignSelf: "flex-start", backgroundColor: "#F1F1F1" },
  correction: { color: "#7A4B00", backgroundColor: "#FFF4D6", padding: 8, borderRadius: 8, marginTop: 6 },
  status: { color: "#B00020", marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#CCC", borderRadius: 10, padding: 12, fontSize: 16 },
  send: { backgroundColor: "#2F5BEA", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "#FFF", fontWeight: "600" },
});

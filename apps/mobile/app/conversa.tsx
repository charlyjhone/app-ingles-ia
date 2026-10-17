import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiClientError } from "@app/api-client";
import {
  DEFAULT_SCENARIO_ID,
  LEVEL_LABEL_PT,
  Level,
  MISSION_XP,
  getScenario,
  type ChatMessage,
  type Correction,
} from "@app/contracts";
import { ENV } from "../src/env";
import { api } from "../src/services";
import {
  canListen,
  friendlyListenError,
  listen,
  speak,
  stopSpeaking,
  type ListenSession,
} from "../src/voice";

const newId = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

type Phase = "idle" | "listening" | "sending";

export default function Conversa() {
  const kids = ENV.variant === "kids";
  const params = useLocalSearchParams<{ scenario?: string; level?: string }>();
  const scenario = getScenario(params.scenario) ?? getScenario(DEFAULT_SCENARIO_ID[kids ? "kids" : "student"])!;
  const level = Level.catch("beginner").parse(params.level);
  const voice = { kids, level };
  const sessionId = useRef(newId()).current;
  const listenRef = useRef<ListenSession | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // A primeira fala do tutor aparece na tela; o servidor já sabe dela (não vai no histórico enviado).
  const opener: ChatMessage = { role: "assistant", text: scenario.openerEn };
  const [history, setHistory] = useState<ChatMessage[]>([opener]);
  const [missionDone, setMissionDone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const micAvailable = canListen();

  // Ao abrir: o tutor fala a primeira frase. Ao sair: para de ouvir e de falar.
  useEffect(() => {
    const t = setTimeout(() => speak(scenario.openerEn, voice), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      listenRef.current?.cancel();
      stopSpeaking();
    },
    [],
  );

  async function send(userText: string, spokenSeconds = 0) {
    const clean = userText.trim();
    if (!clean || phase === "sending") return;
    setPhase("sending");
    setStatus(null);
    setPartial("");
    setHistory((h) => [...h, { role: "user", text: clean }]);
    try {
      const r = await api.conversationTurn({
        sessionId,
        scenario: scenario.id,
        level,
        history: history.slice(1).slice(-20),
        userText: clean,
        spokenSeconds,
      });
      setHistory((h) => [...h, { role: "assistant", text: r.replyText }]);
      setCorrections(r.corrections);
      setText("");
      if (autoSpeak) speak(r.replyText, voice);
      if (r.missionCompleted && !missionDone) {
        setMissionDone(true);
        if ((r.xpAwarded ?? 0) >= MISSION_XP) setCelebrate(true);
      }
    } catch (e) {
      setHistory((h) => h.slice(0, -1)); // devolve a fala para o aluno tentar de novo
      if (!spokenSeconds) setText(clean);
      setStatus(e instanceof ApiClientError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setPhase("idle");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  async function toggleMic() {
    if (phase === "listening") {
      listenRef.current?.stop(); // termina e envia
      return;
    }
    if (phase !== "idle") return;
    stopSpeaking(); // não ouvir a própria voz do tutor
    setStatus(null);
    setPartial("");
    setPhase("listening");
    const session = listen(setPartial);
    listenRef.current = session;
    try {
      const { text: heard, spokenSeconds } = await session.done;
      setPhase("idle");
      await send(heard, spokenSeconds);
    } catch (e) {
      setPhase("idle");
      setPartial("");
      const code = e instanceof Error ? e.message : "";
      if (code !== "aborted") setStatus(friendlyListenError(code));
    } finally {
      listenRef.current = null;
    }
  }

  const listening = phase === "listening";
  const sending = phase === "sending";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${scenario.emoji} ${scenario.titlePt}` }} />
      {scenario.mission && (
        <View style={StyleSheet.flatten([styles.missionCard, missionDone && styles.missionCardDone])}>
          <Text style={styles.missionText}>
            {missionDone ? "✅ " : "🎯 "}
            <Text style={{ fontWeight: "600" }}>{missionDone ? "Missão cumprida: " : "Sua missão: "}</Text>
            {scenario.mission.pt}
          </Text>
        </View>
      )}
      {celebrate && (
        <Pressable onPress={() => setCelebrate(false)} style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>
            🏆 {kids ? "Muito bem! Você conseguiu!" : "Missão cumprida!"} +{MISSION_XP} pontos
          </Text>
          <Text style={styles.bannerHint}>Pode continuar conversando ou escolher outra situação.</Text>
        </Pressable>
      )}
      <View style={styles.toolbar}>
        {!kids && <Text style={styles.levelTag}>Nível: {LEVEL_LABEL_PT[level]}</Text>}
        <Pressable
          onPress={() => {
            if (autoSpeak) stopSpeaking();
            setAutoSpeak((v) => !v);
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: autoSpeak }}
        >
          <Text style={styles.toolbarText}>{autoSpeak ? "🔊 Voz do tutor: ligada" : "🔇 Voz do tutor: desligada"}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={history}
        keyExtractor={(_, i) => String(i)}
        ListFooterComponent={
          history.length > 1 ? null : (
          <Text style={styles.empty}>
            {micAvailable
              ? kids
                ? "Toque no microfone e responda!"
                : "Toque no microfone e responda em inglês. Você também pode digitar."
              : "Digite sua resposta em inglês."}
          </Text>
          )
        }
        renderItem={({ item }) =>
          item.role === "assistant" ? (
            <Pressable onPress={() => speak(item.text, voice)} accessibilityHint="Toque para ouvir de novo">
              <Text style={[styles.bubble, styles.bot]}>
                {item.text} <Text style={styles.replay}>🔊</Text>
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.bubble, styles.user]}>{item.text}</Text>
          )
        }
      />

      {corrections.map((c, i) => (
        <Text key={i} style={styles.correction}>
          ✏️ {c.suggestion} — {c.explanationPt}
        </Text>
      ))}

      {listening && <Text style={styles.partial}>{partial ? `"${partial}"` : "Ouvindo… fale em inglês"}</Text>}
      {sending && <Text style={styles.partial}>O tutor está pensando…</Text>}
      {status && (
        <Text style={styles.status} accessibilityRole="alert">
          {status}
        </Text>
      )}
      {!micAvailable && (
        <Text style={styles.hint}>
          Para falar com o tutor, use o Chrome, Edge ou Safari. Por enquanto, você pode digitar.
        </Text>
      )}

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type in English…"
          maxLength={1000}
          editable={!listening}
          onSubmitEditing={() => send(text)}
        />
        {text.trim() ? (
          <Pressable style={styles.send} onPress={() => send(text)} disabled={sending} accessibilityRole="button">
            <Text style={styles.sendText}>{sending ? "…" : "Enviar"}</Text>
          </Pressable>
        ) : micAvailable ? (
          <Pressable
            style={StyleSheet.flatten([styles.mic, listening && styles.micOn])}
            onPress={toggleMic}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={listening ? "Parar e enviar" : "Falar em inglês"}
          >
            <Text style={styles.micText}>{listening ? "■" : "🎤"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 },
  levelTag: { color: "#555555", fontSize: 13 },
  missionCard: { backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 8 },
  missionCardDone: { backgroundColor: "#E3F6E8" },
  missionText: { fontSize: 15, color: "#1F2A4D" },
  banner: { backgroundColor: "#FFF1C2", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F2C94C" },
  bannerText: { fontSize: 18, fontWeight: "700", color: "#6B4E00", textAlign: "center" },
  bannerHint: { fontSize: 13, color: "#6B4E00", textAlign: "center", marginTop: 4 },
  toolbarText: { color: "#2F5BEA", fontSize: 14 },
  empty: { textAlign: "center", color: "#666666", marginTop: 20, fontSize: 16, paddingHorizontal: 16 },
  bubble: { padding: 12, borderRadius: 12, marginVertical: 4, maxWidth: "85%", fontSize: 16 },
  user: { alignSelf: "flex-end", backgroundColor: "#DCE6FF" },
  bot: { alignSelf: "flex-start", backgroundColor: "#F1F1F1" },
  replay: { fontSize: 13 },
  correction: { color: "#7A4B00", backgroundColor: "#FFF4D6", padding: 8, borderRadius: 8, marginTop: 6 },
  partial: { color: "#2F5BEA", marginTop: 8, fontStyle: "italic" },
  status: { color: "#B00020", marginTop: 6 },
  hint: { color: "#666666", marginTop: 6, fontSize: 13 },
  row: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#CCCCCC", borderRadius: 10, padding: 12, fontSize: 16 },
  send: { backgroundColor: "#2F5BEA", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  sendText: { color: "#FFFFFF", fontWeight: "600" },
  mic: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#2F5BEA", alignItems: "center", justifyContent: "center" },
  micOn: { backgroundColor: "#C62828" },
  micText: { color: "#FFFFFF", fontSize: 22 },
});

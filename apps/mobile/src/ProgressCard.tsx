import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { ProgressResponse } from "@app/contracts";
import { api } from "./services";

/** Sequência de dias e meta diária. Se falhar, simplesmente não aparece (nunca trava a tela). */
export function ProgressCard({ kids }: { kids: boolean }) {
  const [p, setP] = useState<ProgressResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .progress()
        .then((r) => alive && setP(r))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []),
  );

  if (!p) return null;
  const pct = Math.min(1, p.xpToday / p.dailyGoal);

  return (
    <View style={[styles.card, kids && styles.kidsCard]} accessibilityLabel="Seu progresso">
      <View style={styles.row}>
        <Text style={styles.big}>🔥 {p.streakDays}</Text>
        <Text style={styles.label}>
          {p.streakDays === 1 ? "dia seguido" : "dias seguidos"}
          {p.streakDays > 0 && p.xpToday === 0 ? " — pratique hoje para não perder!" : ""}
        </Text>
      </View>
      <Text style={styles.label}>
        {p.goalReached ? "✅ Meta de hoje cumprida!" : `Meta de hoje: ${p.xpToday} de ${p.dailyGoal} pontos`}
      </Text>
      <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: p.dailyGoal, now: p.xpToday }}>
        <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
      {!kids && p.reviewsDue > 0 && (
        <Text style={styles.label}>📚 {p.reviewsDue} {p.reviewsDue === 1 ? "palavra" : "palavras"} para revisar</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFF7E6", borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: "#FFE0A3" },
  kidsCard: { borderRadius: 24, padding: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  big: { fontSize: 26, fontWeight: "700" },
  label: { fontSize: 15, color: "#5A4300" },
  bar: { height: 10, backgroundColor: "#FFE7B8", borderRadius: 5, overflow: "hidden" },
  fill: { height: 10, backgroundColor: "#FF9500", borderRadius: 5 },
});

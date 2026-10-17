import { useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LEVEL_LABEL_PT, SCENARIOS, type Level } from "@app/contracts";
import { ENV } from "../src/env";

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export default function Cenarios() {
  const kids = ENV.variant === "kids";
  const [level, setLevel] = useState<Level>("beginner");
  const list = SCENARIOS.filter((s) => s.audience === (kids ? "kids" : "student"));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!kids && (
        <>
          <Text style={styles.label}>Seu nível</Text>
          <View style={styles.chips}>
            {LEVELS.map((l) => (
              <Pressable
                key={l}
                onPress={() => setLevel(l)}
                style={StyleSheet.flatten([styles.chip, level === l && styles.chipOn])}
                accessibilityRole="radio"
                accessibilityState={{ checked: level === l }}
              >
                <Text style={[styles.chipText, level === l && styles.chipTextOn]}>{LEVEL_LABEL_PT[l]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Escolha a situação</Text>
        </>
      )}
      {list.map((s) => (
        <Pressable
          key={s.id}
          style={StyleSheet.flatten([styles.card, kids && styles.kidsCard])}
          onPress={() => router.push({ pathname: "/conversa", params: { scenario: s.id, level } })}
          accessibilityRole="button"
        >
          <Text style={kids ? styles.kidsEmoji : styles.emoji}>{s.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, kids && styles.kidsTitle]}>{s.titlePt}</Text>
            {s.mission ? (
              <Text style={styles.mission}>🎯 {s.mission.pt}</Text>
            ) : (
              <Text style={styles.mission}>Fale sobre o que quiser, sem missão.</Text>
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  label: { fontSize: 15, fontWeight: "600", color: "#444444", marginTop: 6 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderColor: "#2F5BEA", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: "#2F5BEA" },
  chipText: { color: "#2F5BEA", fontSize: 15 },
  chipTextOn: { color: "#FFFFFF", fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F5F7FF",
    borderWidth: 1,
    borderColor: "#E0E6FF",
  },
  kidsCard: { backgroundColor: "#FFF4D6", borderColor: "#FFD27A", padding: 20, borderRadius: 24 },
  emoji: { fontSize: 32 },
  kidsEmoji: { fontSize: 48 },
  title: { fontSize: 17, fontWeight: "600" },
  kidsTitle: { fontSize: 22 },
  mission: { color: "#555555", marginTop: 3, fontSize: 14 },
});

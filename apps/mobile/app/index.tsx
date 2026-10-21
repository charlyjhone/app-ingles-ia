import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ENV } from "../src/env";
import { ProgressCard } from "../src/ProgressCard";

export default function Home() {
  const kids = ENV.variant === "kids";
  return (
    <View style={styles.container}>
      <Text style={[styles.title, kids && styles.kidsTitle]}>{kids ? "Hello, friend!" : "Pronto para praticar?"}</Text>
      <ProgressCard kids={kids} />
      <Link href="/cenarios" asChild>
        <Pressable style={StyleSheet.flatten([styles.button, kids && styles.kidsButton])} accessibilityRole="button">
          <Text style={styles.buttonText}>{kids ? "Falar com o amigo" : "Conversar com o tutor"}</Text>
        </Pressable>
      </Link>
      {!kids && (
        <Link href="/revisao" asChild>
          <Pressable style={StyleSheet.flatten([styles.button, styles.secondary])} accessibilityRole="button">
            <Text style={[styles.buttonText, styles.secondaryText]}>Revisar palavras</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
  kidsTitle: { fontSize: 34, textAlign: "center" },
  button: { backgroundColor: "#2F5BEA", padding: 18, borderRadius: 14, alignItems: "center" },
  kidsButton: { backgroundColor: "#FF8A00", padding: 28, borderRadius: 28 },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  secondary: { backgroundColor: "#EEF2FF" },
  secondaryText: { color: "#2F5BEA" },
});

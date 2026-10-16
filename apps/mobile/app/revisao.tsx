import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReviewItem } from "@app/contracts";
import { api } from "../src/services";

export default function Revisao() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.reviewNext().then((r) => setItems(r.items)).catch(() => setError("Não foi possível carregar a revisão."));
  }, []);

  const current = items[0];

  async function answer(correct: boolean) {
    if (!current) return;
    await api.reviewAnswer({ itemId: current.id, correct }).catch(() => undefined);
    setItems((list) => list.slice(1));
    setRevealed(false);
  }

  if (error) return <Text style={styles.center}>{error}</Text>;
  if (!current) return <Text style={styles.center}>Tudo revisado por hoje! 🎉</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.term}>{current.term}</Text>
      {revealed ? (
        <>
          <Text style={styles.translation}>{current.translationPt}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.wrong]} onPress={() => answer(false)}>
              <Text style={styles.btnText}>Errei</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.right]} onPress={() => answer(true)}>
              <Text style={styles.btnText}>Acertei</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable style={styles.btn} onPress={() => setRevealed(true)}>
          <Text style={styles.btnText}>Mostrar tradução</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  center: { flex: 1, textAlign: "center", textAlignVertical: "center", padding: 24, fontSize: 18 },
  term: { fontSize: 40, fontWeight: "700" },
  translation: { fontSize: 24, color: "#555" },
  row: { flexDirection: "row", gap: 12 },
  btn: { backgroundColor: "#2F5BEA", paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  wrong: { backgroundColor: "#C62828" },
  right: { backgroundColor: "#2E7D32" },
  btnText: { color: "#FFF", fontSize: 17, fontWeight: "600" },
});

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ENV } from "../src/env";
import { isWeb } from "../src/services";

export default function RootLayout() {
  const kids = ENV.variant === "kids";
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: kids ? "#FFE8A3" : "#FFFFFF" },
          headerTitleStyle: { fontSize: kids ? 22 : 17 },
          // No computador, conteúdo centralizado em coluna legível (não esticado na tela toda).
          contentStyle: isWeb ? { width: "100%", maxWidth: 760, alignSelf: "center" } : undefined,
        }}
      >
        <Stack.Screen name="index" options={{ title: kids ? "Vamos brincar!" : "Inglês com IA" }} />
        <Stack.Screen name="conversa" options={{ title: "Conversa" }} />
        <Stack.Screen name="revisao" options={{ title: "Revisão" }} />
      </Stack>
    </>
  );
}

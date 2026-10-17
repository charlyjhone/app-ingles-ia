import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ENV } from "../src/env";
import { LoginScreen } from "../src/LoginScreen";
import { isWeb, signOut } from "../src/services";
import { useSession } from "../src/useSession";

export default function RootLayout() {
  const kids = ENV.variant === "kids";
  const session = useSession();

  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Sem login, nada do app aparece: só a tela de entrada.
  if (!session) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: kids ? "#FFE8A3" : "#FFFFFF" },
          headerTitleStyle: { fontSize: kids ? 22 : 17 },
          // Botão "Sair" sempre visível: importante nos computadores compartilhados da escola.
          headerRight: () => (
            <Pressable onPress={signOut} accessibilityRole="button" style={{ paddingHorizontal: 12 }}>
              <Text style={{ color: "#2F5BEA", fontSize: 15 }}>Sair</Text>
            </Pressable>
          ),
          // No computador, conteúdo centralizado em coluna legível (não esticado na tela toda).
          contentStyle: isWeb ? { width: "100%", maxWidth: 760, alignSelf: "center" } : undefined,
        }}
      >
        <Stack.Screen name="index" options={{ title: kids ? "Vamos brincar!" : "Inglês com IA" }} />
        <Stack.Screen name="cenarios" options={{ title: kids ? "Do que vamos brincar?" : "Escolha a conversa" }} />
        <Stack.Screen name="conversa" options={{ title: "Conversa" }} />
        <Stack.Screen name="revisao" options={{ title: "Revisão" }} />
      </Stack>
    </>
  );
}

import "../../global.css";
import { useEffect } from "react";
import { AppState, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Button,
  PaperProvider,
  Text,
} from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export default function RootLayout() {
  const ready = useAppStore((state) => state.ready);
  const error = useAppStore((state) => state.error);
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!ready) return;
    // Даты повторений обновляются, когда возвращаемся в приложение.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void useAppStore.getState().refresh().catch(console.error);
    });
    return () => subscription.remove();
  }, [ready]);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        {ready ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="deck/[id]" />
            <Stack.Screen name="study/[id]" />
          </Stack>
        ) : (
          <View
            className="flex-1 items-center justify-center gap-4 px-8"
            style={{ backgroundColor: theme.colors.background }}
          >
            <Text variant="headlineMedium" style={{ fontWeight: "700" }}>
              qword
            </Text>
            {error ? (
              <>
                <Text style={{ textAlign: "center" }}>{error}</Text>
                <Button mode="contained" onPress={() => void initialize()}>
                  Попробовать снова
                </Button>
              </>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        )}
      </PaperProvider>
    </SafeAreaProvider>
  );
}

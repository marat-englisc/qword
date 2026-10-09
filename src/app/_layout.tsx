import "../../global.css";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Button,
  PaperProvider,
  Text,
} from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { initializeDatabase } from "@/config/connection";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <StartupBoundary>
          <DatabaseLoader />
        </StartupBoundary>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

class StartupBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Не удалось открыть приложение:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <StartupScreen
          error="Не удалось открыть приложение. Попробуйте ещё раз."
          retry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function DatabaseLoader() {
  const [initialized, setInitialized] = useState(false);
  const onInit = useCallback(async (database: SQLiteDatabase) => {
    try {
      await initializeDatabase(database);
      setInitialized(true);
    } catch (error) {
      await database.closeAsync();
      throw error;
    }
  }, []);

  return (
    <>
      {!initialized && <StartupScreen />}
      <SQLiteProvider
        databaseName="qword-meanings.db"
        assetSource={{ assetId: require("../../local.db") }}
        onInit={onInit}
      >
        <AppNavigator />
      </SQLiteProvider>
    </>
  );
}

function StartupScreen({
  error,
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  return (
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
          <Button mode="contained" onPress={retry}>
            Попробовать снова
          </Button>
        </>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

function AppNavigator() {
  const ready = useAppStore((state) => state.ready);
  const error = useAppStore((state) => state.error);
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!ready) {
    return (
      <StartupScreen error={error} retry={() => void initialize()} />
    );
  }

  return (
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
  );
}

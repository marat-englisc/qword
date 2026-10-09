import "../../global.css";
import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform, View } from "react-native";
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
import * as SystemUI from "expo-system-ui";
import { initializeDatabase } from "@/config/connection";
import { useAppStore } from "@/store";
import { darkTheme, lightTheme, useAppTheme } from "@/theme";
import { Stars } from "@/components/PatriotBrand";

export default function RootLayout() {
  const appearance = useAppStore((state) => state.settings.appearance);
  const theme = appearance === "dark" ? darkTheme : lightTheme;
  useEffect(() => {
    if (Platform.OS !== "web") Appearance.setColorScheme(appearance);
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(
      console.error,
    );
  }, [appearance, theme]);
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style={theme.dark ? "light" : "dark"} />
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
  const theme = useAppTheme();
  return (
    <View
      className="flex-1 items-center justify-center gap-4 px-8"
      style={{ backgroundColor: theme.colors.hero }}
    >
      <Text
        variant="headlineMedium"
        style={{
          fontWeight: "900",
          letterSpacing: -1,
          color: theme.colors.onHero,
        }}
      >
        qword
      </Text>
      <Stars color={theme.colors.star} />
      {error ? (
        <>
          <Text style={{ textAlign: "center", color: theme.colors.onHero }}>
            {error}
          </Text>
          <Button
            mode="contained"
            buttonColor={theme.colors.accent}
            textColor={theme.colors.onAccent}
            onPress={retry}
          >
            Попробовать снова
          </Button>
        </>
      ) : (
        <ActivityIndicator color={theme.colors.onHero} />
      )}
    </View>
  );
}

function AppNavigator() {
  const theme = useAppTheme();
  const ready = useAppStore((state) => state.ready);
  const error = useAppStore((state) => state.error);
  const initialize = useAppStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!ready) {
    return <StartupScreen error={error} retry={() => void initialize()} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="statistics" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="deck/[id]" />
      <Stack.Screen name="study/[id]" />
    </Stack>
  );
}

import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  ProgressBar,
  Snackbar,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import AppNavigation from "@/components/AppNavigation";
import { useForegroundEffect } from "@/hooks/useForegroundEffect";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export default function DecksScreen() {
  const decks = useAppStore((state) => state.decks);
  const overview = useAppStore((state) => state.overview);
  const refresh = useAppStore((state) => state.refresh);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useForegroundEffect(
    useCallback(() => {
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      const update = async () => {
        try {
          await refresh();
          if (active) setError("");
        } catch {
          if (active) setError("Не удалось обновить колоды. Попробуйте ещё раз.");
        } finally {
          if (active) timer = setTimeout(() => void update(), 30_000);
        }
      };
      void update();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [refresh]),
    retry,
  );

  const reviews = (overview?.reviewCount ?? 0) + (overview?.learningCount ?? 0);
  const newCount = overview?.newCount ?? 0;
  const available = reviews + newCount;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="w-full max-w-[620px] flex-1 self-center">
        <FlatList
          data={decks}
          keyExtractor={(deck) => String(deck.id)}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 32,
            paddingTop: 20,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <>
              <View className="mb-8 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Avatar.Icon
                    size={36}
                    icon="cards-outline"
                    style={{ backgroundColor: theme.colors.primaryContainer }}
                    color={theme.colors.primary}
                  />
                  <Text variant="headlineSmall" style={{ fontWeight: "800" }}>
                    qword
                  </Text>
                </View>
                <Chip
                  compact
                  style={{ backgroundColor: theme.colors.secondaryContainer }}
                >
                  EN → RU
                </Chip>
              </View>

              <Text
                variant="headlineLarge"
                style={{ fontWeight: "700", lineHeight: 40 }}
              >
                Английский,{"\n"}значение за значением.
              </Text>
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginTop: 12,
                  marginBottom: 28,
                }}
              >
                Одно слово может значить разное.{"\n"}Изучайте каждое значение
                отдельно.
              </Text>

              <Card
                mode="contained"
                style={{
                  backgroundColor: theme.colors.primaryContainer,
                  borderRadius: 24,
                }}
              >
                <Card.Content style={{ padding: 24 }}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.primary, letterSpacing: 1 }}
                  >
                    ВАША ПРАКТИКА
                  </Text>
                  <Text
                    variant="headlineSmall"
                    style={{ fontWeight: "700", marginTop: 16 }}
                  >
                    {available ? "Время для практики" : "Можно сделать паузу"}
                  </Text>
                  <View className="my-5 flex-row gap-8">
                    <View className="gap-1">
                      <Text variant="headlineLarge" style={{ fontWeight: "700" }}>
                        {reviews}
                      </Text>
                      <Text style={{ color: theme.colors.primary }}>
                        к повторению
                      </Text>
                    </View>
                    <View className="gap-1">
                      <Text variant="headlineLarge" style={{ fontWeight: "700" }}>
                        {newCount}
                      </Text>
                      <Text style={{ color: theme.colors.primary }}>
                        новых значений
                      </Text>
                    </View>
                  </View>
                  {available ? (
                    <Button
                      mode="contained"
                      icon="arrow-right"
                      contentStyle={{ minHeight: 48 }}
                      onPress={() => router.push("/study/all")}
                    >
                      Начать практику
                    </Button>
                  ) : (
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.primary }}
                    >
                      {decks.some((deck) => deck.added)
                        ? "Сейчас нет доступных значений. Вернитесь к следующему повторению."
                        : "Выберите колоду и добавьте её к изучению."}
                    </Text>
                  )}
                  {overview?.newBlocked && (
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.primary, marginTop: 12 }}
                    >
                      Новые значения появятся, когда станет меньше повторений и
                      карточек в обучении.
                    </Text>
                  )}
                </Card.Content>
              </Card>

              <View className="mb-4 mt-8 flex-row items-center justify-between">
                <Text variant="titleLarge" style={{ fontWeight: "700" }}>
                  Коллекции
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {decks.length}
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Пока нет колод.
            </Text>
          }
          renderItem={({ item: deck }) => (
            <Card
              mode="contained"
              onPress={() => router.push(`/deck/${deck.id}`)}
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 20,
              }}
              accessibilityLabel={`Открыть колоду ${deck.name}`}
              accessibilityRole="button"
            >
              <Card.Content style={{ paddingVertical: 20 }}>
                <View className="flex-row items-center gap-4">
                  <Avatar.Icon
                    icon="cards-outline"
                    size={52}
                    color={theme.colors.primary}
                    style={{
                      backgroundColor: theme.colors.primaryContainer,
                      borderRadius: 16,
                    }}
                  />
                  <View className="flex-1 gap-1">
                    <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                      {deck.name}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Слов: {deck.wordCount} · значений: {deck.meaningCount}
                    </Text>
                  </View>
                  <Icon
                    source="chevron-right"
                    size={22}
                    color={theme.colors.onSurfaceVariant}
                  />
                </View>
                <View style={{ height: 4, marginTop: 20 }}>
                  <ProgressBar
                    progress={
                      deck.meaningCount
                        ? deck.studiedMeaningCount / deck.meaningCount
                        : 0
                    }
                    color={theme.colors.secondary}
                    style={{
                      height: 4,
                      borderRadius: 4,
                      backgroundColor: theme.colors.surfaceVariant,
                    }}
                  />
                </View>
                <View className="mt-3 gap-1">
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Знакомы {deck.studiedMeaningCount} из {deck.meaningCount}{" "}
                    значений
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.primary }}
                  >
                    {deck.added
                      ? `${deck.reviewCount} к повторению · ${deck.newMeaningCount} ещё не изучено`
                      : "Не добавлена к изучению"}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      </View>
      <AppNavigation active="collections" />
      <Snackbar
        visible={!!error}
        onDismiss={() => setError("")}
        action={{
          label: "Повторить",
          onPress: () => setRetry((value) => value + 1),
        }}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
}

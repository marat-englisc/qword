import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  ProgressBar,
  Snackbar,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { createEmptyCard, type Grade } from "ts-fsrs";
import WordCard from "@/components/WordCard";
import { builtInDecks } from "@/content/decks";
import { formatInterval, ratings, scheduler } from "@/lib/scheduler";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export function generateStaticParams() {
  return [{ id: "all" }, ...builtInDecks.map((deck) => ({ id: deck.id }))];
}

export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    queue,
    sessionId,
    sessionTotal,
    answered,
    revealed,
    saving,
    decks,
    now,
    startSession,
    reveal,
    answer,
    refresh,
  } = useAppStore();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const word = queue[0];
  const deck = decks.find((item) => item.id === id);
  const validDeck = id === "all" || !!deck;
  const relevantDecks =
    id === "all" ? decks : decks.filter((item) => item.id === id);
  const nextDates = relevantDecks.flatMap((item) =>
    item.nextDue === null ? [] : [item.nextDue],
  );
  const nextDue = nextDates.length ? Math.min(...nextDates) : null;

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      let active = true;
      startSession(id)
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      const timer = setInterval(() => {
        void refresh().catch(console.error);
      }, 30_000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [id, startSession, refresh]),
  );

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function rate(rating: Grade) {
    try {
      await answer(rating);
    } catch {
      setError(true);
    }
  }

  // repeat нужен только для подсказок. Результат сохраняется после нажатия оценки.
  const preview = word
    ? scheduler.repeat(
        word.card ?? createEmptyCard(new Date(now)),
        new Date(now),
      )
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="w-full max-w-[620px] flex-1 self-center">
        <Appbar.Header
          statusBarHeight={0}
          style={{ backgroundColor: theme.colors.background }}
        >
          <Appbar.Action
            icon="close"
            onPress={goBack}
            accessibilityLabel="Завершить практику"
          />
          <Appbar.Content
            title={id === "all" ? "Практика" : (deck?.title ?? "Практика")}
            titleStyle={{ fontSize: 18 }}
          />
          {!loading && word && (
            <Text variant="labelLarge" style={{ marginRight: 24 }}>
              {answered + 1} / {sessionTotal}
            </Text>
          )}
        </Appbar.Header>

        {loading || sessionId !== id ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : word && validDeck ? (
          <>
            <View className="px-6 pb-4">
              <View style={{ height: 4 }}>
                <ProgressBar
                  progress={sessionTotal ? answered / sessionTotal : 0}
                  color={theme.colors.primary}
                  style={{
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: "#E7E3EF",
                  }}
                />
              </View>
              <Text
                variant="bodySmall"
                style={{ marginTop: 14, color: theme.colors.onSurfaceVariant }}
              >
                {word.card ? "Повторение" : "Новое слово"} ·{" "}
                {revealed
                  ? "Оцените, насколько легко вспомнили слово"
                  : "Сначала вспомните перевод, затем откройте ответ"}
              </Text>
            </View>
            <ScrollView
              key={word.id}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 24,
                flexGrow: 1,
              }}
            >
              <WordCard key={word.id} word={word} revealed={revealed} />
            </ScrollView>
            <View
              className="gap-3 px-6 pb-4 pt-3"
              style={{
                borderTopWidth: 1,
                borderColor: theme.colors.outlineVariant,
              }}
            >
              {revealed && preview ? (
                <>
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      textAlign: "center",
                    }}
                  >
                    Когда повторить это слово
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {ratings.map((rating) => (
                      <View
                        key={rating.value}
                        style={{ width: "48%", flexGrow: 1 }}
                      >
                        <Button
                          mode="contained"
                          buttonColor={rating.background}
                          textColor={rating.color}
                          contentStyle={{ minHeight: 48 }}
                          labelStyle={{ marginHorizontal: 8, fontSize: 13 }}
                          disabled={saving}
                          onPress={() => void rate(rating.value)}
                          accessibilityLabel={`${rating.label}, через ${formatInterval(preview[rating.value].card.due, now)}`}
                        >
                          {rating.label} ·{" "}
                          {formatInterval(preview[rating.value].card.due, now)}
                        </Button>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Button
                  mode="contained"
                  onPress={reveal}
                  contentStyle={{ minHeight: 52 }}
                >
                  Показать ответ
                </Button>
              )}
            </View>
          </>
        ) : (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 32,
            }}
          >
            <View className="items-center gap-5">
              <Avatar.Icon
                icon={validDeck ? "check" : "cards-outline"}
                size={80}
                color={theme.colors.secondary}
                style={{ backgroundColor: theme.colors.secondaryContainer }}
              />
              <Text
                variant="headlineMedium"
                style={{ fontWeight: "700", textAlign: "center" }}
              >
                {validDeck
                  ? answered
                    ? "Хорошая работа!"
                    : "Пока всё пройдено"
                  : "Колода не найдена"}
              </Text>
              <Text
                variant="bodyLarge"
                style={{
                  textAlign: "center",
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {answered
                  ? `Карточек за эту практику: ${answered}.`
                  : "Сейчас нет доступных карточек."}
              </Text>
              {nextDue !== null && validDeck && (
                <Text
                  variant="bodyMedium"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  Следующее повторение{" "}
                  {nextDue <= now
                    ? "уже доступно"
                    : `через ${formatInterval(nextDue, now)}`}
                  .
                </Text>
              )}
              <Button
                mode="contained"
                onPress={goBack}
                contentStyle={{ minHeight: 48 }}
              >
                Вернуться к колоде
              </Button>
              {nextDue !== null && validDeck && (
                <Button
                  onPress={() => {
                    void startSession(id).catch(() => setError(true));
                  }}
                >
                  Проверить доступные карточки
                </Button>
              )}
            </View>
          </ScrollView>
        )}
        <Snackbar
          visible={error}
          onDismiss={() => setError(false)}
          duration={5000}
        >
          Не удалось сохранить ответ. Попробуйте нажать оценку ещё раз.
        </Snackbar>
      </View>
    </SafeAreaView>
  );
}

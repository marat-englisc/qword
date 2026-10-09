import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Chip,
  Snackbar,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Grade } from "ts-fsrs";
import WordCard from "@/components/WordCard";
import { formatInterval, ratings } from "@/lib/scheduler";
import { previewStudyCard } from "@/lib/study";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentCard,
    examples,
    session,
    sessionId,
    answered,
    revealed,
    saving,
    decks,
    startSession,
    refreshSession,
    reveal,
    answer,
  } = useAppStore();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const deck = decks.find((item) => item.id === Number(id));
  const validDeck = id === "all" || !!deck?.added;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError("");
      setLoading(true);
      if (!validDeck) {
        setLoading(false);
        return;
      }
      void startSession(id)
        .catch(() => {
          if (active)
            setError("Не удалось загрузить практику. Попробуйте ещё раз.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      const timer = setInterval(() => {
        const time = Date.now();
        if (active) setNow(time);
        const state = useAppStore.getState();
        const wakeAt = Math.min(
          state.session?.nextDue?.getTime() ?? Infinity,
          state.session?.newResetAt.getTime() ?? Infinity,
        );
        if (!state.currentCard && !state.saving && time >= wakeAt) {
          void refreshSession().catch(() => {
            if (active) setError("Не удалось обновить очередь.");
          });
        }
      }, 1000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [id, validDeck, startSession, refreshSession]),
  );

  function goBack() {
    if (saving) return;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function rate(rating: Grade) {
    try {
      setError("");
      await answer(rating);
    } catch {
      setError(
        "Не удалось сохранить ответ или загрузить следующее значение. Попробуйте ещё раз.",
      );
    }
  }

  async function reload() {
    setLoading(true);
    setError("");
    try {
      if (sessionId === id && session) await refreshSession();
      else await startSession(id);
    } catch {
      setError("Не удалось загрузить практику.");
    } finally {
      setLoading(false);
    }
  }

  const preview = currentCard
    ? previewStudyCard(currentCard, new Date(now))
    : null;
  const nextDue = session?.nextDue;

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
            disabled={saving}
            accessibilityLabel="Завершить практику"
          />
          <Appbar.Content
            title={id === "all" ? "Практика" : (deck?.name ?? "Практика")}
            titleStyle={{ fontSize: 18 }}
          />
          <Text variant="labelLarge" style={{ marginRight: 20 }}>
            Ответов: {answered}
          </Text>
        </Appbar.Header>

        {loading || (saving && !currentCard) ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : currentCard && validDeck && sessionId === id ? (
          <>
            <View className="gap-3 px-6 pb-4">
              <View className="flex-row flex-wrap gap-2">
                <Chip compact>{session?.learningCount ?? 0} в обучении</Chip>
                <Chip compact>{session?.reviewCount ?? 0} повторений</Chip>
                <Chip compact>{session?.newCount ?? 0} новых</Chip>
              </View>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {currentCard.kind === "new"
                  ? "Новое значение"
                  : currentCard.kind === "learning"
                    ? "Закрепление значения"
                    : "Повторение значения"}
                {" · "}
                {revealed
                  ? "Оцените, насколько легко вспомнили это значение"
                  : "Вспомните значение по подсказке и откройте ответ"}
              </Text>
            </View>
            <ScrollView
              key={currentCard.meaning.id}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 24,
                flexGrow: 1,
              }}
            >
              <WordCard
                key={currentCard.meaning.id}
                card={currentCard}
                examples={examples}
                revealed={revealed}
              />
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
                    Когда повторить это значение
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
                {!validDeck
                  ? "Колода не добавлена"
                  : !session
                    ? "Не удалось загрузить практику"
                    : answered
                      ? "Хорошая работа!"
                      : "Пока всё пройдено"}
              </Text>
              <Text
                variant="bodyLarge"
                style={{
                  textAlign: "center",
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {answered
                  ? `Ответов за эту практику: ${answered}.`
                  : "Сейчас нет доступных значений."}
              </Text>
              {nextDue && validDeck && (
                <Text
                  variant="bodyMedium"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  Следующее повторение{" "}
                  {nextDue.getTime() <= now
                    ? "уже доступно"
                    : `через ${formatInterval(nextDue, now)}`}
                  .
                </Text>
              )}
              {session?.newRemainingToday === 0 && (
                <Text
                  variant="bodyMedium"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  Дневной лимит новых значений достигнут. Он обновится в 04:00.
                </Text>
              )}
              {session?.newBlocked && (
                <Text
                  variant="bodyMedium"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  Новые значения пока приостановлены. Разберите повторения в
                  добавленных колодах.
                </Text>
              )}
              {validDeck && (
                <Button
                  mode="contained"
                  onPress={() => void reload()}
                  contentStyle={{ minHeight: 48 }}
                >
                  Проверить доступные значения
                </Button>
              )}
              <Button onPress={goBack}>Вернуться к колодам</Button>
            </View>
          </ScrollView>
        )}
        <Snackbar
          visible={!!error}
          onDismiss={() => setError("")}
          duration={5000}
        >
          {error}
        </Snackbar>
      </View>
    </SafeAreaView>
  );
}

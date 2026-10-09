import { useCallback, useMemo, useRef, useState } from "react";
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
import { useShallow } from "zustand/react/shallow";
import WordCard from "@/components/WordCard";
import { useForegroundEffect } from "@/hooks/useForegroundEffect";
import { formatInterval, ratings } from "@/lib/scheduler";
import { previewStudyCard } from "@/lib/study";
import { StudyCardUnavailableError } from "@/lib/studyErrors";
import { useAppStore } from "@/store";
import { useAppTheme } from "@/theme";
import { formatDayStart } from "@/lib/settings";

export default function StudyScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const settings = useAppStore((state) => state.settings);
  const id = typeof params.id === "string" ? params.id : "";
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
    now: previewTime,
  } = useAppStore(
    useShallow((state) => ({
      currentCard: state.currentCard,
      examples: state.examples,
      session: state.session,
      sessionId: state.sessionId,
      answered: state.answered,
      revealed: state.revealed,
      saving: state.saving,
      decks: state.decks,
      startSession: state.startSession,
      refreshSession: state.refreshSession,
      reveal: state.reveal,
      answer: state.answer,
      now: state.now,
    })),
  );
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const reloadingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const deck = decks.find((item) => item.id === Number(id));
  const validId = id === "all" ||
    (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)));
  const validDeck = validId && (id === "all" || !!deck?.added);
  const sessionMatches = sessionId === id;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError("");
      setLoadFailed(false);
      setLoading(true);
      if (!validDeck) {
        setLoading(false);
        return;
      }
      void startSession(id)
        .catch(() => {
          if (active) {
            setLoadFailed(true);
            setError("Не удалось загрузить практику. Попробуйте ещё раз.");
          }
        })
        .finally(() => {
          if (active) {
            setNow(Date.now());
            setLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [id, validDeck, startSession]),
  );

  useForegroundEffect(
    useCallback(() => {
      if (loading || saving || currentCard || !validDeck || !sessionMatches || !session)
        return;
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      const update = async () => {
        const time = Date.now();
        setNow(time);
        const wakeAt = Math.min(
          session.nextDue?.getTime() ?? Infinity,
          session.newResetAt.getTime(),
        );
        if (time >= wakeAt && !reloadingRef.current) {
          reloadingRef.current = true;
          try {
            await refreshSession();
            if (active) {
              setLoadFailed(false);
              setError("");
            }
          } catch {
            if (active) {
              setLoadFailed(true);
              setError("Не удалось обновить очередь. Попробуйте ещё раз.");
            }
          } finally {
            reloadingRef.current = false;
          }
        }
        if (active) {
          const wait = wakeAt - Date.now();
          timer = setTimeout(
            () => void update(),
            wait > 0 ? Math.min(30_000, Math.max(1000, wait)) : 30_000,
          );
        }
      };
      void update();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [loading, saving, currentCard, validDeck, sessionMatches, session, refreshSession]),
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
    } catch (error) {
      if (!useAppStore.getState().currentCard) setLoadFailed(true);
      setError(
        error instanceof StudyCardUnavailableError
          ? error.message
          : "Не удалось сохранить ответ или загрузить следующее значение. Попробуйте ещё раз.",
      );
    }
  }

  async function reload() {
    if (reloadingRef.current || !validDeck) return;
    reloadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      if (sessionId === id && session) await refreshSession();
      else await startSession(id);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      setError("Не удалось загрузить практику.");
    } finally {
      reloadingRef.current = false;
      setNow(Date.now());
      setLoading(false);
    }
  }

  const preview = useMemo(
    () => currentCard && revealed
      ? previewStudyCard(currentCard, new Date(previewTime), settings)
      : null,
    [currentCard, revealed, previewTime, settings],
  );
  const nextDue = sessionMatches ? session?.nextDue : null;
  const answerCount = sessionMatches ? answered : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="w-full max-w-[620px] flex-1 self-center">
        <Appbar.Header
          statusBarHeight={0}
          style={{
            backgroundColor: theme.colors.hero,
            borderBottomWidth: 3,
            borderBottomColor: theme.colors.accent,
            marginBottom: 18,
          }}
        >
          <Appbar.Action
            icon="close"
            color={theme.colors.onHero}
            onPress={goBack}
            disabled={saving}
            accessibilityLabel="Завершить практику"
          />
          <Appbar.Content
            title={id === "all" ? "Практика" : (deck?.name ?? "Практика")}
            color={theme.colors.onHero}
            titleStyle={{ fontSize: 18, fontWeight: "800" }}
          />
          <Text variant="labelLarge" style={{
            marginRight: 16,
            paddingHorizontal: 10,
            paddingVertical: 6,
            color: theme.colors.onHero,
            backgroundColor: theme.colors.heroBorder,
            borderRadius: 10,
            fontWeight: "700",
          }}>
            Ответов: {answerCount}
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
                <Chip compact style={{ backgroundColor: theme.colors.primaryContainer }} textStyle={{ color: theme.colors.onPrimaryContainer, fontWeight: "700" }}>{session?.learningCount ?? 0} в обучении</Chip>
                <Chip compact style={{ backgroundColor: theme.colors.surfaceVariant }} textStyle={{ color: theme.colors.onSurfaceVariant, fontWeight: "700" }}>{session?.reviewCount ?? 0} повторений</Chip>
                <Chip compact style={{ backgroundColor: theme.colors.accentContainer }} textStyle={{ color: theme.colors.onAccentContainer, fontWeight: "700" }}>{session?.newCount ?? 0} новых</Chip>
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
                backgroundColor: theme.colors.surface,
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
                    {ratings.map((rating, index) => (
                      <View
                        key={rating.value}
                        style={{ width: "48%", flexGrow: 1 }}
                      >
                        <Button
                          mode="contained"
                          buttonColor={theme.ratings[index].background}
                          textColor={theme.ratings[index].color}
                          contentStyle={{ minHeight: 48 }}
                          labelStyle={{ marginHorizontal: 8, fontSize: 13, fontWeight: "700" }}
                          disabled={saving}
                          onPress={() => void rate(rating.value)}
                          accessibilityLabel={`${rating.label}, через ${formatInterval(preview[rating.value].card.due, previewTime)}`}
                        >
                          {rating.label} ·{" "}
                          {formatInterval(preview[rating.value].card.due, previewTime)}
                        </Button>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Button
                  mode="contained"
                  icon="star-outline"
                  buttonColor={theme.colors.accent}
                  textColor={theme.colors.onAccent}
                  onPress={reveal}
                  disabled={saving}
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
                icon={loadFailed ? "alert-circle-outline" : validDeck ? "star-check-outline" : "cards-outline"}
                size={80}
                color={theme.colors.onPrimaryContainer}
                style={{
                  backgroundColor: theme.colors.primaryContainer,
                  borderWidth: 2,
                  borderColor: theme.colors.outlineVariant,
                  borderRadius: 24,
                }}
              />
              <Text
                variant="headlineMedium"
                style={{ fontWeight: "900", textAlign: "center" }}
              >
                {!validId || (id !== "all" && !deck)
                  ? "Колода не найдена"
                  : !validDeck
                    ? "Колода не добавлена"
                    : loadFailed || !sessionMatches || !session
                      ? "Не удалось загрузить практику"
                      : answerCount
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
                {!validId || (id !== "all" && !deck)
                  ? "Вернитесь к списку и выберите доступную колоду."
                  : !validDeck
                    ? "Добавьте колоду к изучению на экране колоды."
                    : loadFailed || !sessionMatches || !session
                      ? "Попробуйте загрузить доступные значения ещё раз."
                      : answerCount
                        ? `Ответов за эту практику: ${answerCount}.`
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
              {validDeck && sessionMatches && session?.newRemainingToday === 0 && (
                <Text
                  variant="bodyMedium"
                  style={{
                    textAlign: "center",
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  {settings.newCardsPerDay === 0 ? "Новые значения отключены в настройках." : `Дневной лимит новых значений достигнут. Он обновится в ${formatDayStart(settings.dayStartHour)}.`}
                </Text>
              )}
              {validDeck && sessionMatches && session?.newBlocked && (
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
              {validDeck && sessionMatches && session?.reviewLimited && (
                <Text variant="bodyMedium" style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}>
                  {settings.reviewsPerDay === 0 ? "Обычные повторения отключены в настройках. Короткие закрепления доступны." : `Дневной лимит обычных повторений достигнут. Он обновится в ${formatDayStart(settings.dayStartHour)}. Короткие закрепления доступны.`}
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

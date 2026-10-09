import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  Icon,
  IconButton,
  Portal,
  Searchbar,
  Snackbar,
  Text,
  TouchableRipple,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { State } from "ts-fsrs";
import WordCard from "@/components/WordCard";
import {
  getCardExamples,
  getDeckMeanings,
} from "@/db/repositories/cardRepository";
import type { StudyCard } from "@/db/repositories/studyRepository";
import { useForegroundEffect } from "@/hooks/useForegroundEffect";
import { formatInterval } from "@/lib/scheduler";
import { formatDayStart } from "@/lib/settings";
import { getStudyQueue } from "@/lib/study";
import { useAppStore } from "@/store";
import { useAppTheme } from "@/theme";

export default function DeckScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const deckId =
    typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  const validId = Number.isSafeInteger(deckId);
  const decks = useAppStore((state) => state.decks);
  const refresh = useAppStore((state) => state.refresh);
  const addDeck = useAppStore((state) => state.addDeck);
  const removeDeck = useAppStore((state) => state.removeDeck);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const now = useAppStore((state) => state.now);
  const settings = useAppStore((state) => state.settings);
  const [meanings, setMeanings] = useState<StudyCard[]>([]);
  const [study, setStudy] = useState<Awaited<
    ReturnType<typeof getStudyQueue>
  > | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StudyCard | null>(null);
  const [examples, setExamples] = useState<
    Awaited<ReturnType<typeof getCardExamples>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState(false);
  const [examplesRetry, setExamplesRetry] = useState(0);
  const [error, setError] = useState("");
  const deck = decks.find((item) => item.id === deckId);

  useForegroundEffect(
    useCallback(() => {
      let active = true;
      let initial = true;
      let timer: ReturnType<typeof setTimeout>;
      setLoading(validId);
      setLoadFailed(false);
      setError("");
      const update = async () => {
        if (!validId) return;
        try {
          await refresh();
          const [rows, queue] = await Promise.all([
            initial ? getDeckMeanings(deckId) : Promise.resolve(null),
            getStudyQueue({ deckId }),
          ]);
          if (active) {
            if (rows) setMeanings(rows);
            setStudy(queue);
            setLoadFailed(false);
            setError("");
            initial = false;
          }
        } catch {
          if (active) {
            if (initial) setLoadFailed(true);
            setError("Не удалось загрузить колоду. Попробуйте ещё раз.");
          }
        } finally {
          if (active) {
            setLoading(false);
            timer = setTimeout(() => void update(), 30_000);
          }
        }
      };
      void update();
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [deckId, validId, refresh]),
    retry,
  );

  useFocusEffect(useCallback(() => () => setSelected(null), []));

  useEffect(() => {
    let active = true;
    if (selected) {
      void getCardExamples(selected.meaning.id)
        .then((rows) => {
          if (active) setExamples(rows);
        })
        .catch(() => {
          if (active) setExamplesError(true);
        })
        .finally(() => {
          if (active) setExamplesLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [selected, examplesRetry]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function addToStudy() {
    if (addingRef.current || !validId) return;
    addingRef.current = true;
    setAdding(true);
    try {
      await addDeck(deckId);
      setStudy(await getStudyQueue({ deckId }));
    } catch {
      setError("Не удалось добавить колоду.");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  async function unsubscribe() {
    if (addingRef.current || !validId) return;
    addingRef.current = true;
    setAdding(true);
    try {
      await removeDeck(deckId);
      setStudy(null);
      setConfirmRemoval(false);
    } catch {
      setError("Не удалось отписаться от коллекции. Попробуйте ещё раз.");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      meanings.filter(({ word, meaning }) =>
        `${word.title} ${meaning.hint ?? ""} ${meaning.meaning} ${meaning.meaningTranslation}`
          .toLowerCase()
          .includes(query),
      ),
    [meanings, query],
  );
  const available = study?.queue.length ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="w-full max-w-[620px] flex-1 self-center">
        <Appbar.Header
          statusBarHeight={0}
          style={{
            backgroundColor: theme.colors.background,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.outlineVariant,
          }}
        >
          <Appbar.BackAction onPress={goBack} accessibilityLabel="К колодам" />
          <Appbar.Content
            title={deck?.name ?? "Колода"}
            titleStyle={{ fontSize: 18, fontWeight: "800" }}
          />
          {deck?.added && (
            <Appbar.Action
              icon="playlist-remove"
              disabled={adding}
              onPress={() => setConfirmRemoval(true)}
              accessibilityLabel="Отписаться от коллекции"
            />
          )}
        </Appbar.Header>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : loadFailed ? (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Text variant="titleLarge" style={{ textAlign: "center" }}>
              Не удалось загрузить колоду
            </Text>
            <Button
              mode="contained"
              onPress={() => setRetry((value) => value + 1)}
            >
              Повторить
            </Button>
          </View>
        ) : deck ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.meaning.id)}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View className="gap-4 pb-4 pt-4">
                <View
                  style={{
                    backgroundColor: theme.colors.hero,
                    borderRadius: 24,
                    padding: 22,
                    gap: 16,
                    borderBottomWidth: 5,
                    borderBottomColor: theme.colors.accent,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text
                        variant="labelSmall"
                        style={{
                          color: theme.colors.heroMuted,
                          fontWeight: "800",
                          letterSpacing: 2,
                        }}
                      >
                        QWORD / КОЛЛЕКЦИЯ
                      </Text>
                      <View
                        accessible={false}
                        style={{ flexDirection: "row", gap: 5 }}
                      >
                        {[0, 1, 2].map((star) => (
                          <Icon
                            key={star}
                            source="star"
                            size={13}
                            color={theme.colors.star}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  <Text
                    variant="headlineMedium"
                    style={{
                      color: theme.colors.onHero,
                      fontWeight: "900",
                      letterSpacing: -0.5,
                    }}
                  >
                    {deck.name}
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.heroMuted }}
                  >
                    Слов: {deck.wordCount} · значений: {deck.meaningCount}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Каждое значение изучается отдельно. Нажмите на строку, чтобы
                  посмотреть его определение и примеры.
                </Text>
                {deck.added ? (
                  <Button
                    mode="contained"
                    icon="cards-outline"
                    buttonColor={theme.colors.accent}
                    textColor={theme.colors.onAccent}
                    disabled={!available || adding}
                    contentStyle={{ minHeight: 48 }}
                    onPress={() => router.push(`/study/${deckId}`)}
                  >
                    {available
                      ? `Учить · ${available}`
                      : "Пока нет доступных значений"}
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    icon="plus"
                    buttonColor={theme.colors.accent}
                    textColor={theme.colors.onAccent}
                    loading={adding}
                    disabled={adding || !deck.meaningCount}
                    contentStyle={{ minHeight: 48 }}
                    onPress={() => void addToStudy()}
                  >
                    Добавить к изучению
                  </Button>
                )}
                {deck.added && (
                  <Button
                    mode="text"
                    icon="playlist-remove"
                    textColor={theme.colors.onSurfaceVariant}
                    disabled={adding}
                    onPress={() => setConfirmRemoval(true)}
                  >
                    Отписаться от коллекции
                  </Button>
                )}
                {deck.added && !available && study?.nextDue && (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Следующее повторение{" "}
                    {study.nextDue.getTime() <= now
                      ? "уже доступно"
                      : `через ${formatInterval(study.nextDue, now)}`}
                    .
                  </Text>
                )}
                {deck.added && study?.newBlocked && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Сначала разберите текущие повторения и значения в обучении.
                  </Text>
                )}
                {deck.added && study?.newRemainingToday === 0 && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {settings.newCardsPerDay === 0
                      ? "Новые значения отключены в настройках."
                      : `Дневной лимит новых значений достигнут. Он обновится в ${formatDayStart(settings.dayStartHour)}.`}
                  </Text>
                )}
                {deck.added && study?.reviewLimited && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {settings.reviewsPerDay === 0
                      ? "Обычные повторения отключены в настройках."
                      : `Очередь ограничена дневным лимитом повторений. Лимит обновится в ${formatDayStart(settings.dayStartHour)}.`}
                  </Text>
                )}
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: "900", marginTop: 16 }}
                >
                  Значения в колоде
                </Text>
                <Searchbar
                  placeholder="Найти слово или значение"
                  value={search}
                  onChangeText={setSearch}
                  accessibilityLabel="Найти слово или значение"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    borderRadius: 16,
                  }}
                />
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <Text
                style={{
                  paddingVertical: 24,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {query
                  ? "Ничего не найдено."
                  : "В этой колоде пока нет значений."}
              </Text>
            }
            renderItem={({ item }) => {
              const studied =
                item.progress && item.progress.state !== State.New;
              return (
                <TouchableRipple
                  onPress={() => {
                    setExamples([]);
                    setExamplesLoading(true);
                    setExamplesError(false);
                    setSelected(item);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Посмотреть значение ${item.word.title}: ${item.meaning.meaningTranslation}`}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <View className="flex-row items-center gap-3 p-4">
                    <View className="flex-1 gap-1">
                      <Text variant="titleMedium" style={{ fontWeight: "800" }}>
                        {item.word.title}
                      </Text>
                      {!!item.word.transcription && (
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {item.word.transcription}
                        </Text>
                      )}
                      {!!item.meaning.hint && (
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {item.meaning.hint}
                        </Text>
                      )}
                      <Text variant="bodyMedium">
                        {item.meaning.meaningTranslation}
                      </Text>
                    </View>
                    <Text
                      variant="labelSmall"
                      style={{
                        color: studied
                          ? theme.colors.onPositiveContainer
                          : theme.colors.onAccentContainer,
                        backgroundColor: studied
                          ? theme.colors.positiveContainer
                          : theme.colors.accentContainer,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        fontWeight: "700",
                      }}
                    >
                      {studied ? "Знакомое" : "Новое"}
                    </Text>
                    <Icon
                      source="chevron-right"
                      size={20}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </View>
                </TouchableRipple>
              );
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Text variant="titleLarge">Колода не найдена</Text>
            <Button onPress={goBack}>К колодам</Button>
          </View>
        )}
      </View>
      <Portal>
        <Dialog
          visible={confirmRemoval}
          onDismiss={() => {
            if (!adding) setConfirmRemoval(false);
          }}
          style={{
            width: "90%",
            maxWidth: 580,
            alignSelf: "center",
            backgroundColor: theme.colors.surface,
          }}
        >
          <Dialog.Title>Отписаться от коллекции?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              «{deck?.name}» больше не будет появляться в практике. Прогресс и
              история ответов сохранятся. Вы сможете снова добавить коллекцию в
              любой момент.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={adding} onPress={() => setConfirmRemoval(false)}>
              Оставить
            </Button>
            <Button
              textColor={theme.colors.accent}
              loading={adding}
              disabled={adding}
              onPress={() => void unsubscribe()}
            >
              Отписаться
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={!!selected}
          onDismiss={() => setSelected(null)}
          style={{
            width: "90%",
            maxWidth: 580,
            maxHeight: "85%",
            alignSelf: "center",
            backgroundColor: theme.colors.surface,
          }}
        >
          <View className="flex-row items-center justify-between px-4">
            <Text variant="titleMedium">Значение слова</Text>
            <IconButton
              icon="close"
              onPress={() => setSelected(null)}
              accessibilityLabel="Закрыть значение"
            />
          </View>
          <Dialog.ScrollArea
            style={{
              paddingHorizontal: 0,
              borderTopWidth: 0,
              borderBottomWidth: 0,
            }}
          >
            <ScrollView>
              {selected && (
                <WordCard
                  key={selected.meaning.id}
                  card={selected}
                  examples={examples}
                  revealed
                />
              )}
              {examplesLoading && <ActivityIndicator style={{ margin: 20 }} />}
              {examplesError && (
                <View className="gap-2 p-4">
                  <Text style={{ color: theme.colors.error }}>
                    Не удалось загрузить примеры.
                  </Text>
                  <Button
                    onPress={() => {
                      setExamplesLoading(true);
                      setExamplesError(false);
                      setExamplesRetry((value) => value + 1);
                    }}
                  >
                    Повторить
                  </Button>
                </View>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSelected(null)}>Закрыть</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!error} onDismiss={() => setError("")}>
        {error}
      </Snackbar>
    </SafeAreaView>
  );
}

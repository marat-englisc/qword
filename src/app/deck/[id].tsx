import { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Dialog,
  Divider,
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
import { formatInterval } from "@/lib/scheduler";
import { getStudyQueue } from "@/lib/study";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const decks = useAppStore((state) => state.decks);
  const refresh = useAppStore((state) => state.refresh);
  const addDeck = useAppStore((state) => state.addDeck);
  const now = useAppStore((state) => state.now);
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
  const [error, setError] = useState("");
  const deck = decks.find((item) => item.id === deckId);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const update = async () => {
        if (!Number.isInteger(deckId) || deckId <= 0) {
          if (active) setLoading(false);
          return;
        }
        await refresh();
        const [rows, queue] = await Promise.all([
          getDeckMeanings(deckId),
          getStudyQueue({ deckId }),
        ]);
        if (active) {
          setMeanings(rows);
          setStudy(queue);
          setLoading(false);
        }
      };
      void update().catch(() => {
        if (active) {
          setError("Не удалось загрузить колоду.");
          setLoading(false);
        }
      });
      const timer = setInterval(
        () => void update().catch(console.error),
        30_000,
      );
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [deckId, refresh]),
  );

  useEffect(() => {
    let active = true;
    if (selected) {
      void getCardExamples(selected.meaning.id)
        .then((rows) => {
          if (active) setExamples(rows);
        })
        .catch(() => {
          if (active) setError("Не удалось загрузить примеры.");
        });
    }
    return () => {
      active = false;
    };
  }, [selected]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function addToStudy() {
    if (adding) return;
    setAdding(true);
    try {
      await addDeck(deckId);
      setStudy(await getStudyQueue({ deckId }));
    } catch {
      setError("Не удалось добавить колоду.");
    } finally {
      setAdding(false);
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = meanings.filter(({ word, meaning }) =>
    `${word.title} ${meaning.hint ?? ""} ${meaning.meaningTranslation}`
      .toLowerCase()
      .includes(query),
  );
  const available = study?.queue.length ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="w-full max-w-[620px] flex-1 self-center">
        <Appbar.Header
          statusBarHeight={0}
          style={{ backgroundColor: theme.colors.background }}
        >
          <Appbar.BackAction onPress={goBack} />
          <Appbar.Content
            title={deck?.name ?? "Колода"}
            titleStyle={{ fontSize: 18 }}
          />
        </Appbar.Header>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : deck ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.meaning.id)}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View className="gap-4 pb-3 pt-2">
                <Avatar.Icon
                  icon="cards-outline"
                  size={64}
                  color={theme.colors.primary}
                  style={{
                    backgroundColor: theme.colors.primaryContainer,
                    borderRadius: 20,
                  }}
                />
                <Text variant="headlineLarge" style={{ fontWeight: "700" }}>
                  {deck.name}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Слов: {deck.wordCount} · значений: {deck.meaningCount}
                </Text>
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
                    disabled={!available}
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
                    loading={adding}
                    disabled={adding || !deck.meaningCount}
                    contentStyle={{ minHeight: 48 }}
                    onPress={() => void addToStudy()}
                  >
                    Добавить к изучению
                  </Button>
                )}
                {deck.added && !available && study?.nextDue && (
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Следующее повторение через{" "}
                    {formatInterval(study.nextDue, now)}.
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
                    Дневной лимит новых значений достигнут. Он обновится в
                    04:00.
                  </Text>
                )}
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: "700", marginTop: 16 }}
                >
                  Значения в колоде
                </Text>
                <Searchbar
                  placeholder="Найти слово или значение"
                  value={search}
                  onChangeText={setSearch}
                  style={{ backgroundColor: theme.colors.surfaceVariant }}
                />
              </View>
            }
            ItemSeparatorComponent={() => <Divider />}
            ListEmptyComponent={
              <Text
                style={{
                  paddingVertical: 24,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Ничего не найдено.
              </Text>
            }
            renderItem={({ item }) => {
              const studied =
                item.progress && item.progress.state !== State.New;
              return (
                <TouchableRipple
                  onPress={() => {
                    setExamples([]);
                    setSelected(item);
                  }}
                  accessibilityLabel={`Посмотреть значение ${item.word.title}: ${item.meaning.meaningTranslation}`}
                >
                  <View className="flex-row items-center gap-3 py-4">
                    <View className="flex-1 gap-1">
                      <Text variant="titleMedium" style={{ fontWeight: "600" }}>
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
                          ? theme.colors.secondary
                          : theme.colors.primary,
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

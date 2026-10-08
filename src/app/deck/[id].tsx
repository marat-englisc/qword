import { useCallback, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Appbar,
  Avatar,
  Button,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Portal,
  Searchbar,
  Text,
  TouchableRipple,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import WordCard from "@/components/WordCard";
import { builtInDecks } from "@/content/decks";
import { getDeckWords, type StudyWord } from "@/db/database";
import { formatInterval } from "@/lib/scheduler";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export function generateStaticParams() {
  return builtInDecks.map((deck) => ({ id: deck.id }));
}

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const decks = useAppStore((state) => state.decks);
  const refresh = useAppStore((state) => state.refresh);
  const now = useAppStore((state) => state.now);
  const [words, setWords] = useState<StudyWord[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StudyWord | null>(null);
  const deck = decks.find((item) => item.id === id);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const update = async () => {
        await refresh();
        const loaded = await getDeckWords(id);
        if (active) setWords(loaded);
      };
      void update().catch(console.error);
      const timer = setInterval(() => {
        void update().catch(console.error);
      }, 30_000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [id, refresh]),
  );

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  const available = deck ? deck.newCount + deck.reviewCount : 0;
  const query = search.trim().toLowerCase();
  const filtered = words.filter((word) =>
    `${word.title} ${word.definitionRu}`.toLowerCase().includes(query),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View className="w-full max-w-[620px] flex-1 self-center">
        <Appbar.Header
          statusBarHeight={0}
          style={{ backgroundColor: theme.colors.background }}
        >
          <Appbar.BackAction onPress={goBack} />
          <Appbar.Content title="Колода" titleStyle={{ fontSize: 18 }} />
        </Appbar.Header>
        {deck ? (
          <FlatList
            data={filtered}
            keyExtractor={(word) => word.id}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View className="gap-4 pb-3 pt-2">
                <Avatar.Icon
                  icon={deck.icon}
                  size={64}
                  color={theme.colors.onSurface}
                  style={{ backgroundColor: deck.color, borderRadius: 20 }}
                />
                <Text variant="headlineLarge" style={{ fontWeight: "700" }}>
                  {deck.title}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {deck.description}
                </Text>
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.secondary }}
                >
                  {deck.level} · {deck.total} слов · {deck.reviewCount} к
                  повторению
                </Text>
                <Button
                  mode="contained"
                  icon="cards-outline"
                  disabled={!available}
                  contentStyle={{ minHeight: 48 }}
                  onPress={() => router.push(`/study/${id}`)}
                >
                  {available ? `Учить · ${available}` : "Карточки пройдены"}
                </Button>
                {!available && deck.nextDue && (
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      textAlign: "center",
                    }}
                  >
                    Следующее повторение через{" "}
                    {formatInterval(deck.nextDue, now)}
                  </Text>
                )}
                <View className="mt-4 gap-3">
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    Слова в колоде
                  </Text>
                  <Searchbar
                    placeholder="Найти слово"
                    value={search}
                    onChangeText={setSearch}
                    style={{ backgroundColor: "#F0EEE8" }}
                    inputStyle={{ minHeight: 48 }}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Нажмите на слово, чтобы посмотреть карточку.
                  </Text>
                </View>
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
            renderItem={({ item }) => (
              <TouchableRipple
                onPress={() => setSelected(item)}
                accessibilityLabel={`Посмотреть слово ${item.title}`}
              >
                <View className="flex-row items-center gap-3 py-4">
                  <View className="flex-1 gap-1">
                    <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                      {item.title}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {item.ipa}
                    </Text>
                  </View>
                  <Text
                    variant="labelSmall"
                    style={{
                      color: item.card
                        ? theme.colors.secondary
                        : theme.colors.primary,
                    }}
                  >
                    {item.card ? "Знакомое" : "Новое"}
                  </Text>
                  <Icon
                    source="chevron-right"
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                </View>
              </TouchableRipple>
            )}
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
            <Text variant="titleMedium">Карточка слова</Text>
            <IconButton
              icon="close"
              onPress={() => setSelected(null)}
              accessibilityLabel="Закрыть карточку"
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
                <WordCard key={selected.id} word={selected} revealed />
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSelected(null)}>Закрыть</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

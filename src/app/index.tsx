import { useCallback, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  Card,
  Icon,
  ProgressBar,
  Snackbar,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import AppNavigation from "@/components/AppNavigation";
import { FlagStripe, Stars } from "@/components/PatriotBrand";
import { useForegroundEffect } from "@/hooks/useForegroundEffect";
import { useAppStore } from "@/store";
import { useAppTheme } from "@/theme";

export default function DecksScreen() {
  const theme = useAppTheme();
  const compact = useWindowDimensions().width < 360;
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
          if (active)
            setError("Не удалось обновить колоды. Попробуйте ещё раз.");
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
      <View
        style={{ width: "100%", maxWidth: 620, flex: 1, alignSelf: "center" }}
      >
        <FlatList
          data={decks}
          keyExtractor={(deck) => String(deck.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 28,
            paddingTop: 16,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListHeaderComponent={
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 22,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: theme.colors.hero,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      borderBottomWidth: 4,
                      borderBottomColor: theme.colors.accent,
                    }}
                  >
                    <Stars color={theme.colors.star} count={1} size={21} />
                  </View>
                  <View>
                    <Text
                      variant="headlineSmall"
                      style={{ fontWeight: "900", letterSpacing: -1 }}
                    >
                      qword
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{
                        fontSize: 9,
                        letterSpacing: 1.8,
                        fontWeight: "800",
                        color: theme.colors.onSurfaceVariant,
                      }}
                    >
                      ENGLISH CLUB
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    alignItems: "center",
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Icon
                    source="translate"
                    color={theme.colors.accent}
                    size={16}
                  />
                  <Text
                    variant="labelMedium"
                    style={{ fontWeight: "800", color: theme.colors.primary }}
                  >
                    EN → RU
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: theme.colors.hero,
                  borderRadius: 24,
                  overflow: "hidden",
                }}
              >
                <View style={{ padding: 22 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.heroMuted,
                        letterSpacing: 2.4,
                        fontWeight: "800",
                      }}
                    >
                      THE AMERICAN WAY
                    </Text>
                    <Stars color={theme.colors.star} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 16,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="headlineLarge"
                        style={{
                          fontWeight: "900",
                          fontSize: compact ? 28 : 32,
                          lineHeight: compact ? 32 : 36,
                          letterSpacing: -0.8,
                          color: theme.colors.onHero,
                        }}
                      >
                        Свобода{"\n"}говорить.
                      </Text>
                      <Text
                        variant="labelLarge"
                        style={{
                          color: theme.colors.heroMuted,
                          fontSize: compact ? 10 : 14,
                          marginTop: 8,
                          letterSpacing: compact ? 0.8 : 1.2,
                          fontWeight: "700",
                        }}
                      >
                        ONE WORD AT A TIME
                      </Text>
                    </View>
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: theme.colors.heroMuted,
                      lineHeight: 22,
                      marginTop: 16,
                    }}
                  >
                    Английский, значение за значением.{"\n"}Ваш маленький шаг к
                    большим разговорам.
                  </Text>
                </View>
                <FlagStripe />
              </View>

              <Card
                mode="contained"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  marginTop: 16,
                }}
              >
                <Card.Content style={{ padding: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <Icon
                      source="star-circle-outline"
                      size={18}
                      color={theme.colors.accent}
                    />
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.accent,
                        fontWeight: "800",
                        letterSpacing: 1.6,
                      }}
                    >
                      ВАША ПРАКТИКА
                    </Text>
                  </View>
                  <Text
                    variant="titleLarge"
                    style={{ fontWeight: "800", marginTop: 10 }}
                  >
                    {available
                      ? "Время покорять английский"
                      : "Сегодня можно выдохнуть"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      marginVertical: 18,
                      gap: 16,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: theme.colors.primaryContainer,
                        padding: 12,
                        borderRadius: 14,
                      }}
                    >
                      <Text
                        variant="headlineMedium"
                        style={{
                          color: theme.colors.primary,
                          fontWeight: "900",
                        }}
                      >
                        {reviews}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onPrimaryContainer }}
                      >
                        к повторению
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: theme.colors.accentContainer,
                        padding: 12,
                        borderRadius: 14,
                      }}
                    >
                      <Text
                        variant="headlineMedium"
                        style={{
                          color: theme.colors.onAccentContainer,
                          fontWeight: "900",
                        }}
                      >
                        {newCount}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onAccentContainer }}
                      >
                        новых значений
                      </Text>
                    </View>
                  </View>
                  {available ? (
                    <Button
                      mode="contained"
                      icon="arrow-right"
                      buttonColor={theme.colors.accent}
                      textColor={theme.colors.onAccent}
                      style={{ borderRadius: 14 }}
                      contentStyle={{ minHeight: 48 }}
                      onPress={() => router.push("/study/all")}
                    >
                      Начать практику
                    </Button>
                  ) : (
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        lineHeight: 21,
                      }}
                    >
                      {decks.some((deck) => deck.added)
                        ? "Сейчас нет доступных значений. Вернитесь к следующему повторению."
                        : "Выберите коллекцию и добавьте её к изучению."}
                    </Text>
                  )}
                  {overview?.newBlocked && (
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 12,
                      }}
                    >
                      Новые значения появятся, когда станет меньше повторений и
                      карточек в обучении.
                    </Text>
                  )}
                </Card.Content>
              </Card>

              <View
                style={{
                  marginTop: 26,
                  marginBottom: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 20,
                      borderRadius: 2,
                      backgroundColor: theme.colors.accent,
                    }}
                  />
                  <Text variant="titleLarge" style={{ fontWeight: "800" }}>
                    Коллекции
                  </Text>
                </View>
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {String(decks.length).padStart(2, "0")}
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Пока нет коллекций.
            </Text>
          }
          renderItem={({ item: deck, index }) => (
            <Card
              mode="contained"
              onPress={() => router.push(`/deck/${deck.id}`)}
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
              }}
              accessibilityLabel={`Открыть колоду ${deck.name}`}
              accessibilityRole="button"
            >
              <Card.Content style={{ paddingVertical: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Avatar.Icon
                    icon={index % 2 === 0 ? "cards-outline" : "book-alphabet"}
                    size={46}
                    color={theme.colors.primary}
                    style={{
                      backgroundColor: theme.colors.primaryContainer,
                      borderRadius: 13,
                    }}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="titleMedium" style={{ fontWeight: "800" }}>
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
                    color={theme.colors.primary}
                  />
                </View>
                <ProgressBar
                  progress={
                    deck.meaningCount
                      ? deck.studiedMeaningCount / deck.meaningCount
                      : 0
                  }
                  color={theme.colors.primary}
                  style={{
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: theme.colors.surfaceVariant,
                    marginTop: 18,
                  }}
                />
                <View style={{ marginTop: 10, gap: 4 }}>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Знакомы {deck.studiedMeaningCount} из {deck.meaningCount}{" "}
                    значений
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{
                      color: deck.added
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                    }}
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

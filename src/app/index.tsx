import { useCallback } from "react";
import { ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  ProgressBar,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/store";
import { theme } from "@/theme";

export default function DecksScreen() {
  const decks = useAppStore((state) => state.decks);
  const refresh = useAppStore((state) => state.refresh);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(console.error);
      const timer = setInterval(() => {
        void refresh().catch(console.error);
      }, 30_000);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  const newCount = decks.reduce((sum, deck) => sum + deck.newCount, 0);
  const reviewCount = decks.reduce((sum, deck) => sum + deck.reviewCount, 0);
  const available = newCount + reviewCount;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="w-full max-w-[620px] self-center px-6 pb-8 pt-5">
          <View className="mb-8 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Avatar.Icon
                size={36}
                icon="cards-outline"
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.primary}
              />
              <Text
                variant="headlineSmall"
                style={{ fontWeight: "800", letterSpacing: -1 }}
              >
                qword
              </Text>
            </View>
            <Chip
              compact
              textStyle={{ fontSize: 12 }}
              style={{ backgroundColor: "#E8EEE8" }}
            >
              EN → RU
            </Chip>
          </View>

          <Text
            variant="headlineLarge"
            style={{ fontWeight: "700", lineHeight: 40 }}
          >
            Английский,{"\n"}слово за словом.
          </Text>
          <Text
            variant="bodyLarge"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: 12,
              marginBottom: 28,
            }}
          >
            Несколько минут сегодня.{"\n"}Больше знакомых слов завтра.
          </Text>

          <Card
            mode="contained"
            style={{
              backgroundColor: theme.colors.primaryContainer,
              borderRadius: 24,
            }}
          >
            <Card.Content style={{ padding: 24 }}>
              <View className="flex-row items-center justify-between">
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.primary, letterSpacing: 1 }}
                >
                  ВАША ПРАКТИКА
                </Text>
                <Icon
                  source={available ? "creation" : "check-circle-outline"}
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <Text
                variant="headlineMedium"
                style={{
                  fontWeight: "700",
                  color: theme.colors.onPrimaryContainer,
                  marginTop: 18,
                }}
              >
                {available ? "Время для новых слов" : "Можно сделать паузу"}
              </Text>
              <View className="my-5 flex-row gap-8">
                <View className="gap-1">
                  <Text
                    variant="headlineLarge"
                    style={{
                      fontWeight: "700",
                      color: theme.colors.onPrimaryContainer,
                    }}
                  >
                    {reviewCount}
                  </Text>
                  <Text style={{ color: theme.colors.primary }}>
                    к повторению
                  </Text>
                </View>
                <View className="gap-1">
                  <Text
                    variant="headlineLarge"
                    style={{
                      fontWeight: "700",
                      color: theme.colors.onPrimaryContainer,
                    }}
                  >
                    {newCount}
                  </Text>
                  <Text style={{ color: theme.colors.primary }}>
                    новых слов
                  </Text>
                </View>
              </View>
              {available > 0 ? (
                <Button
                  mode="contained"
                  icon="arrow-right"
                  contentStyle={{ flexDirection: "row-reverse", minHeight: 48 }}
                  onPress={() => router.push("/study/all")}
                >
                  Начать практику
                </Button>
              ) : (
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.primary }}
                >
                  Все доступные карточки пройдены. Возвращайтесь к следующему
                  повторению.
                </Text>
              )}
            </Card.Content>
          </Card>

          <View className="mb-4 mt-8 flex-row items-center justify-between">
            <Text variant="titleLarge" style={{ fontWeight: "700" }}>
              Колоды
            </Text>
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {decks.length}
            </Text>
          </View>

          <View className="gap-3">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                mode="contained"
                onPress={() => router.push(`/deck/${deck.id}`)}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: 20,
                }}
                accessibilityLabel={`Открыть колоду ${deck.title}`}
              >
                <Card.Content style={{ paddingVertical: 20 }}>
                  <View className="flex-row items-center gap-4">
                    <Avatar.Icon
                      icon={deck.icon}
                      size={52}
                      color={theme.colors.onSurface}
                      style={{ backgroundColor: deck.color, borderRadius: 16 }}
                    />
                    <View className="flex-1 gap-1">
                      <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                        {deck.title}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {deck.level} · {deck.total} слов
                      </Text>
                    </View>
                    <Icon
                      source="chevron-right"
                      size={22}
                      color={theme.colors.onSurfaceVariant}
                    />
                  </View>
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 16,
                      marginBottom: 16,
                    }}
                  >
                    {deck.description}
                  </Text>
                  <View style={{ height: 4 }}>
                    <ProgressBar
                      progress={
                        deck.total
                          ? (deck.total - deck.newCount) / deck.total
                          : 0
                      }
                      color={theme.colors.secondary}
                      style={{
                        height: 4,
                        borderRadius: 4,
                        backgroundColor: "#EEEEE8",
                      }}
                    />
                  </View>
                  <View className="mt-3 flex-row justify-between gap-2">
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Знакомы {deck.total - deck.newCount} из {deck.total}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.primary }}
                    >
                      {deck.newCount + deck.reviewCount
                        ? `${deck.newCount + deck.reviewCount} к изучению`
                        : "Всё пройдено"}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
          <View className="mt-7 flex-row items-center justify-center gap-2">
            <Icon source="leaf" size={16} color={theme.colors.secondary} />
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              В своём темпе. Каждый день понемногу.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

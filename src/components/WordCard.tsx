import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { Card, Divider, Icon, IconButton, Snackbar, Text } from "react-native-paper";
import * as Speech from "expo-speech";
import Animated, { FadeIn, FadeInDown, ReduceMotion } from "react-native-reanimated";
import type { StudyCard } from "@/db/repositories/studyRepository";
import type { cardExampleTable } from "@/db/schemas/card/cardExample";
import { useForegroundEffect } from "@/hooks/useForegroundEffect";
import { useAppTheme } from "@/theme";

export default function WordCard({
  card,
  examples,
  revealed,
}: {
  card: StudyCard;
  examples: (typeof cardExampleTable.$inferSelect)[];
  revealed: boolean;
}) {
  const theme = useAppTheme();
  const { word, meaning } = card;
  const meaningExamples = examples.filter(
    (example) => example.cardMeaningId === meaning.id,
  );
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState(false);
  const speechGeneration = useRef(0);
  const speechBusy = useRef(false);

  useForegroundEffect(
    useCallback(() => {
      setSpeaking(false);
      return () => {
        speechGeneration.current++;
        speechBusy.current = false;
        void Speech.stop().catch(() => {});
      };
    }, []),
    meaning.id,
  );

  async function speak() {
    if (speechBusy.current) return;
    speechBusy.current = true;
    const generation = ++speechGeneration.current;
    const finish = (failed = false) => {
      if (generation !== speechGeneration.current) return;
      speechBusy.current = false;
      setSpeaking(false);
      if (failed) setSpeechError(true);
    };
    setSpeechError(false);
    setSpeaking(true);
    try {
      await Speech.stop();
      if (generation !== speechGeneration.current) return;
      Speech.speak(word.title, {
        language: "en-GB",
        rate: 0.85,
        onDone: () => finish(),
        onStopped: () => finish(),
        onError: () => finish(true),
      });
    } catch {
      finish(true);
    }
  }

  return (
    <Animated.View
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
    >
      <Card
        mode="contained"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.hero,
            borderBottomWidth: 4,
            borderBottomColor: theme.colors.accent,
            paddingHorizontal: 20,
            paddingVertical: 13,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onHero, fontWeight: "800", letterSpacing: 2 }}
          >
            QWORD / ENGLISH
          </Text>
          <View accessible={false} style={{ flexDirection: "row", gap: 5 }}>
            {[0, 1, 2].map((star) => (
              <Icon key={star} source="star" size={12} color={theme.colors.onHero} />
            ))}
          </View>
        </View>
        <Card.Content style={{ paddingVertical: 26, paddingHorizontal: 24 }}>
          <View
            className="items-center gap-3"
            style={{ paddingVertical: revealed ? 4 : 32 }}
          >
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 1.6, fontWeight: "700" }}
            >
              {revealed ? "ЗНАЧЕНИЕ СЛОВА" : "ВСПОМНИТЕ ЗНАЧЕНИЕ"}
            </Text>
            <Text
              variant="displaySmall"
              style={{ fontWeight: "900", textAlign: "center", letterSpacing: -1 }}
              selectable
              accessibilityLanguage="en-GB"
            >
              {word.title}
            </Text>
            {!!word.transcription && (
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
                selectable
              >
                {word.transcription}
              </Text>
            )}
            <IconButton
              icon={speaking ? "volume-high" : "volume-medium"}
              mode="contained"
              containerColor={theme.colors.primaryContainer}
              iconColor={theme.colors.onPrimaryContainer}
              size={26}
              onPress={() => void speak()}
              disabled={speaking}
              accessibilityLabel={`Произнести ${word.title}`}
            />
            {!revealed && !!meaning.hint && (
              <View
                className="mt-4 w-full gap-2 rounded-2xl p-4"
                style={{
                  backgroundColor: theme.colors.surfaceVariant,
                  borderLeftWidth: 3,
                  borderLeftColor: theme.colors.accent,
                }}
              >
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Подсказка
                </Text>
                <Text variant="bodyLarge" selectable>
                  {meaning.hint}
                </Text>
              </View>
            )}
          </View>

          {revealed && (
            <Animated.View
              entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
            >
              <Divider style={{ marginVertical: 24 }} />
              <View className="gap-3 rounded-2xl p-4" style={{ backgroundColor: theme.colors.primaryContainer }}>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onPrimaryContainer }}
                  selectable
                  accessibilityLanguage="en-GB"
                >
                  {meaning.meaning}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onPrimaryContainer, fontWeight: "700" }}
                  selectable
                >
                  {meaning.meaningTranslation}
                </Text>
              </View>
              {meaningExamples.length > 0 && (
                <View className="mt-6 gap-3">
                  <Text
                    variant="labelMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      letterSpacing: 1,
                    }}
                  >
                    ПРИМЕРЫ
                  </Text>
                  {meaningExamples.map((example) => (
                    <View
                      key={example.id}
                      className="gap-2 rounded-2xl p-4"
                      style={{
                        backgroundColor: theme.colors.background,
                        borderLeftWidth: 3,
                        borderLeftColor: theme.colors.primary,
                      }}
                    >
                      <Text
                        variant="bodyMedium"
                        selectable
                        accessibilityLanguage="en-GB"
                      >
                        {example.example}
                      </Text>
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurfaceVariant }}
                        selectable
                      >
                        {example.exampleTranslation}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          )}
        </Card.Content>
      </Card>
      <Snackbar
        visible={speechError}
        onDismiss={() => setSpeechError(false)}
        duration={4000}
      >
        Не удалось включить озвучку. Проверьте английский голос на устройстве.
      </Snackbar>
    </Animated.View>
  );
}

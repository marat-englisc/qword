import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, Divider, IconButton, Snackbar, Text } from "react-native-paper";
import * as Speech from "expo-speech";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { StudyCard } from "@/db/repositories/studyRepository";
import type { cardExampleTable } from "@/db/schemas/card/cardExample";
import { theme } from "@/theme";

export default function WordCard({
  card,
  examples,
  revealed,
}: {
  card: StudyCard;
  examples: (typeof cardExampleTable.$inferSelect)[];
  revealed: boolean;
}) {
  const { word, meaning } = card;
  const meaningExamples = examples.filter(
    (example) => example.cardMeaningId === meaning.id,
  );
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState(false);

  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, [meaning.id]);

  async function speak() {
    try {
      await Speech.stop();
      setSpeaking(true);
      Speech.speak(word.title, {
        language: "en-GB",
        rate: 0.85,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => {
          setSpeaking(false);
          setSpeechError(true);
        },
      });
    } catch {
      setSpeaking(false);
      setSpeechError(true);
    }
  }

  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <Card
        mode="contained"
        style={{ backgroundColor: theme.colors.surface, borderRadius: 24 }}
      >
        <Card.Content style={{ paddingVertical: 32, paddingHorizontal: 24 }}>
          <View
            className="items-center gap-3"
            style={{ paddingVertical: revealed ? 4 : 32 }}
          >
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 2 }}
            >
              {revealed ? "ЗНАЧЕНИЕ СЛОВА" : "ВСПОМНИТЕ ЗНАЧЕНИЕ"}
            </Text>
            <Text
              variant="displaySmall"
              style={{ fontWeight: "700", textAlign: "center" }}
              selectable
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
            {!revealed && (
              <>
                <IconButton
                  icon={speaking ? "volume-high" : "volume-medium"}
                  mode="contained"
                  containerColor={theme.colors.primaryContainer}
                  iconColor={theme.colors.primary}
                  size={26}
                  onPress={() => void speak()}
                  accessibilityLabel={`Произнести ${word.title}`}
                />
                {!!meaning.hint && (
                  <View
                    className="mt-4 w-full gap-2 rounded-2xl p-4"
                    style={{ backgroundColor: theme.colors.surfaceVariant }}
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
              </>
            )}
          </View>

          {revealed && (
            <Animated.View entering={FadeInDown.duration(200)}>
              <Divider style={{ marginVertical: 24 }} />
              <View className="gap-3">
                <Text variant="bodyLarge" selectable>
                  {meaning.meaning}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.primary }}
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
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      <Text variant="bodyMedium" selectable>
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

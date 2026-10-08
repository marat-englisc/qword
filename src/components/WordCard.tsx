import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, Divider, IconButton, Snackbar, Text } from "react-native-paper";
import * as Speech from "expo-speech";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { StudyWord } from "@/db/database";
import { theme } from "@/theme";

export default function WordCard({
  word,
  revealed,
}: {
  word: StudyWord;
  revealed: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState(false);

  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );

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
            style={{ paddingVertical: revealed ? 4 : 52 }}
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
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
              selectable
            >
              {word.ipa}
            </Text>
            <IconButton
              icon={speaking ? "volume-high" : "volume-medium"}
              mode="contained"
              containerColor={theme.colors.primaryContainer}
              iconColor={theme.colors.primary}
              size={26}
              onPress={speak}
              accessibilityLabel={`Произнести ${word.title}`}
            />
          </View>

          {revealed && (
            <Animated.View entering={FadeInDown.duration(200)}>
              <Divider style={{ marginVertical: 24 }} />
              <View className="gap-3">
                <Text variant="bodyLarge" selectable>
                  {word.definitionEn}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.primary }}
                  selectable
                >
                  {word.definitionRu}
                </Text>
              </View>
              {word.attributes.length > 0 && (
                <View className="mt-6 gap-3">
                  {word.attributes.map((attribute) => (
                    <View key={attribute.id} className="gap-1">
                      <Text
                        variant="labelMedium"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {attribute.label}
                      </Text>
                      <Text variant="bodyMedium" selectable>
                        {attribute.value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {word.examples.length > 0 && (
                <View className="mt-6 gap-3">
                  <Text
                    variant="labelMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      letterSpacing: 1,
                    }}
                  >
                    В КОНТЕКСТЕ
                  </Text>
                  {word.examples.map((example) => (
                    <View
                      key={example.id}
                      className="gap-2 rounded-2xl p-4"
                      style={{ backgroundColor: "#F8F7F3" }}
                    >
                      <Text variant="bodyMedium" selectable>
                        {example.textEn}
                      </Text>
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurfaceVariant }}
                        selectable
                      >
                        {example.textRu}
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

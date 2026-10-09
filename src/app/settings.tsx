import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Chip, HelperText, Icon, Snackbar, Switch, Text, TextInput } from "react-native-paper";
import SectionScreen, { Panel, SectionHeading } from "@/components/SectionScreen";
import { defaultSettings, parseLearningSteps, settingLimits, validateSettings, type Appearance, type NumericSetting, type StudySettings } from "@/lib/settings";
import { useAppStore } from "@/store";
import { useAppTheme } from "@/theme";

function AppearancePicker() {
  const theme = useAppTheme();
  const appearance = useAppStore((state) => state.settings.appearance);
  const setAppearance = useAppStore((state) => state.setAppearance);
  const [pending, setPending] = useState<Appearance | null>(null);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");

  async function choose(value: Appearance) {
    if (pendingRef.current || value === appearance) return;
    pendingRef.current = true;
    setPending(value);
    setError("");
    try { await setAppearance(value); }
    catch { setError("Не удалось сохранить тему. Попробуйте ещё раз."); }
    finally { pendingRef.current = false; setPending(null); }
  }

  return <Panel title="Цвета свободы" icon="palette-outline">
    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Звёзды, полосы и ваш любимый свет.</Text>
    <View style={{ flexDirection: "row", gap: 12 }}>
      {(["light", "dark"] as const).map((value) => {
        const selected = appearance === value;
        const dark = value === "dark";
        return <Pressable key={value} onPress={() => void choose(value)} disabled={pending !== null}
          accessibilityRole="button" accessibilityLabel={dark ? "Тёмная тема" : "Светлая тема"}
          accessibilityState={{ selected, disabled: pending !== null }} aria-pressed={selected}
          style={({ pressed }) => ({ flex: 1, padding: 8, borderRadius: 18, gap: 10, opacity: pressed ? 0.8 : 1,
            borderWidth: 2, borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
            backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface })}>
          <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none"
            style={{ height: 98, overflow: "hidden", borderRadius: 10, padding: 10, gap: 7,
              backgroundColor: dark ? "#0A1429" : "#F5F7FC" }}>
            <View style={{ height: 33, borderRadius: 5, overflow: "hidden", backgroundColor: "#132B54" }}>
              <View style={{ position: "absolute", left: 8, top: 6, flexDirection: "row", gap: 3 }}>
                {[0, 1, 2].map((star) => <Icon key={star} source="star" size={9} color="#FFFFFF" />)}
              </View>
              <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "38%", gap: 4, paddingTop: 3, transform: [{ skewX: "-14deg" }] }}>
                {[0, 1, 2, 3].map((stripe) => <View key={stripe} style={{ height: 4, backgroundColor: stripe % 2 ? "#FFFFFF" : "#DB3447" }} />)}
              </View>
            </View>
            <View style={{ height: 11, width: "62%", borderRadius: 3, backgroundColor: dark ? "#E6EDFA" : "#14274A" }} />
            <View style={{ height: 19, borderRadius: 5, backgroundColor: dark ? "#1B2E4D" : "#FFFFFF", borderWidth: 1,
              borderColor: dark ? "#2D4368" : "#DFE5F0", borderLeftWidth: 3, borderLeftColor: "#DB3447" }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text variant="labelLarge" style={{ flex: 1, fontWeight: "700", color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface }}>
              {dark ? "Тёмная" : "Светлая"}
            </Text>
            {pending === value ? <ActivityIndicator size={18} /> : <Icon source={selected ? "check-circle" : dark ? "weather-night" : "white-balance-sunny"}
              size={18} color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant} />}
          </View>
        </Pressable>;
      })}
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Icon source="check-decagram-outline" size={16} color={theme.colors.primary} />
      <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>Тема применяется сразу и сохраняется автоматически.</Text>
    </View>
    {!!error && <HelperText type="error" visible accessibilityLiveRegion="polite">{error}</HelperText>}
  </Panel>;
}

function draftFromSettings(settings: StudySettings) {
  return Object.fromEntries((Object.keys(settingLimits) as NumericSetting[]).map((key) =>
    [key, String(key === "requestRetention" ? Math.round(settings[key] * 100) : settings[key])])) as Record<NumericSetting, string>;
}

const numericFields: Record<NumericSetting, { label: string; help: string; unit?: string }> = {
  newCardsPerDay: { label: "Новые значения", help: "На день, для всех коллекций. 0 — учить только знакомые.", unit: "в день" },
  reviewsPerDay: { label: "Обычные повторения", help: "Знакомые значения на день. Короткие закрепления не ограничены.", unit: "в день" },
  reviewsPerNewCard: { label: "Повторений перед новым", help: "Чередование карточек. 0 — сначала новые; закрепления всегда идут первыми." },
  maxDueReviewsForNew: { label: "Порог накопившихся повторений", help: "Если просроченных обычных повторений больше этого числа, новые приостанавливаются." },
  maxLearningCardsForNew: { label: "Вместимость обучения", help: "При таком количестве значений на коротких шагах новые приостанавливаются." },
  dayStartHour: { label: "Начало учебного дня", help: "Час по местному времени (0–23). В это время обновляются оба дневных лимита.", unit: "час" },
  requestRetention: { label: "Целевое запоминание", help: "70–99%. Чем выше цель, тем чаще FSRS назначает повторения.", unit: "%" },
  maximumInterval: { label: "Максимальный интервал", help: "Верхняя граница между обычными повторениями: 1–36500 дней.", unit: "дней" },
};

export default function SettingsScreen() {
  const theme = useAppTheme();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [draft, setDraft] = useState(() => draftFromSettings(settings));
  const [learningSteps, setLearningSteps] = useState(settings.learningSteps.join(", "));
  const [relearningSteps, setRelearningSteps] = useState(settings.relearningSteps.join(", "));
  const [enableFuzz, setEnableFuzz] = useState(settings.enableFuzz);
  const [enableShortTerm, setEnableShortTerm] = useState(settings.enableShortTerm);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const invalidFields = (Object.keys(settingLimits) as NumericSetting[]).filter((key) => {
    const number = key === "requestRetention" ? Number(draft[key]) / 100 : Number(draft[key]);
    const { min, max } = settingLimits[key];
    return !/^\d+$/.test(draft[key].trim()) || number < min || number > max;
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromSettings(settings)) ||
    learningSteps !== settings.learningSteps.join(", ") || relearningSteps !== settings.relearningSteps.join(", ") ||
    enableFuzz !== settings.enableFuzz || enableShortTerm !== settings.enableShortTerm;

  async function save() {
    if (savingRef.current) return;
    setError("");
    if (invalidFields.length) { setError("Проверьте числовые поля: значение должно попадать в указанный диапазон."); return; }
    try {
      const next = validateSettings({
        appearance: settings.appearance,
        ...Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, key === "requestRetention" ? Number(value) / 100 : Number(value)])),
        enableFuzz, enableShortTerm, learningSteps: parseLearningSteps(learningSteps), relearningSteps: parseLearningSteps(relearningSteps),
      });
      savingRef.current = true;
      setSaving(true);
      await updateSettings(next);
      setDraft(draftFromSettings(next));
      setLearningSteps(next.learningSteps.join(", "));
      setRelearningSteps(next.relearningSteps.join(", "));
      setMessage("Настройки сохранены");
    } catch (cause) {
      setError(savingRef.current ? "Не удалось сохранить настройки. Попробуйте ещё раз." :
        cause instanceof Error ? cause.message : "Проверьте параметры обучения.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function reset() {
    setDraft(draftFromSettings(defaultSettings));
    setLearningSteps(defaultSettings.learningSteps.join(", "));
    setRelearningSteps(defaultSettings.relearningSteps.join(", "));
    setEnableFuzz(defaultSettings.enableFuzz);
    setEnableShortTerm(defaultSettings.enableShortTerm);
    setError("");
    setMessage("Исходные значения восстановлены. Нажмите «Сохранить», чтобы применить.");
  }

  function numberField(key: NumericSetting) {
    const field = numericFields[key];
    const invalid = invalidFields.includes(key);
    const { min, max } = settingLimits[key];
    return <View key={key} style={{ gap: 6 }}>
      <TextInput mode="outlined" label={field.label} value={draft[key]} keyboardType="number-pad"
        disabled={saving} error={invalid} accessibilityLabel={field.label}
        onChangeText={(value) => { setDraft((current) => ({ ...current, [key]: value })); setError(""); }}
        right={field.unit ? <TextInput.Affix text={field.unit} /> : undefined}
        style={{ backgroundColor: theme.colors.surface }} outlineStyle={{ borderRadius: 14 }} />
      <Text variant="bodySmall" style={{ color: invalid ? theme.colors.error : theme.colors.onSurfaceVariant, lineHeight: 18 }}>
        {invalid ? `Допустимо: ${key === "requestRetention" ? min * 100 : min}–${key === "requestRetention" ? max * 100 : max}. ` : ""}{field.help}
      </Text>
    </View>;
  }

  return <SectionScreen active="settings">
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} enabled={Platform.OS !== "web"}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 32 }}>
        <SectionHeading title="Настройки" icon="tune-variant" caption="Ваш ритм, ваша нагрузка. Настройте обучение так, чтобы хотелось возвращаться." />
        <AppearancePicker />
        <Panel title="Ежедневный ритм" icon="calendar-check-outline">
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Быстрый выбор нагрузки</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[{ label: "Спокойно", fresh: 5, reviews: 50 }, { label: "Баланс", fresh: 10, reviews: 100 }, { label: "Интенсивно", fresh: 20, reviews: 200 }].map((preset) =>
              <Chip key={preset.label} disabled={saving} selected={Number(draft.newCardsPerDay) === preset.fresh && Number(draft.reviewsPerDay) === preset.reviews}
                onPress={() => setDraft((current) => ({ ...current, newCardsPerDay: String(preset.fresh), reviewsPerDay: String(preset.reviews) }))}
                style={{ backgroundColor: theme.colors.primaryContainer }}>{preset.label}</Chip>)}
          </View>
          {numberField("newCardsPerDay")}
          {numberField("reviewsPerDay")}
          {numberField("dayStartHour")}
        </Panel>
        <Panel title="Память и интервалы · FSRS" icon="brain">
          {numberField("requestRetention")}
          {numberField("maximumInterval")}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}><Text variant="titleSmall">Распределять нагрузку</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Небольшой разброс интервалов, чтобы повторения не скапливались в один день.</Text></View>
            <Switch value={enableFuzz} disabled={saving} onValueChange={setEnableFuzz} accessibilityLabel="Распределять нагрузку FSRS" />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}><Text variant="titleSmall">Короткие закрепления</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Повторять новые и забытые значения через несколько минут.</Text></View>
            <Switch value={enableShortTerm} disabled={saving} onValueChange={setEnableShortTerm} accessibilityLabel="Короткие закрепления FSRS" />
          </View>
          <TextInput mode="outlined" label="Шаги обучения, минуты" value={learningSteps} onChangeText={setLearningSteps}
            disabled={saving || !enableShortTerm} keyboardType="numbers-and-punctuation" accessibilityLabel="Шаги обучения в минутах"
            placeholder="1, 10" style={{ backgroundColor: theme.colors.surface }} outlineStyle={{ borderRadius: 14 }} />
          <TextInput mode="outlined" label="Шаги после забывания, минуты" value={relearningSteps} onChangeText={setRelearningSteps}
            disabled={saving || !enableShortTerm} keyboardType="numbers-and-punctuation" accessibilityLabel="Шаги после забывания в минутах"
            placeholder="10" style={{ backgroundColor: theme.colors.surface }} outlineStyle={{ borderRadius: 14 }} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>До 6 шагов по возрастанию, от 1 до 1440 минут, через запятую. Пустое поле — без фиксированных шагов, интервал рассчитает FSRS.</Text>
        </Panel>
        <Panel title="Порядок карточек" icon="sort-variant">
          <Button mode="text" icon={advanced ? "chevron-up" : "chevron-down"} onPress={() => setAdvanced(!advanced)} accessibilityState={{ expanded: advanced }} aria-expanded={advanced}>
            {advanced ? "Скрыть параметры" : "Параметры очереди"}
          </Button>
          {advanced && <>{numberField("reviewsPerNewCard")}{numberField("maxDueReviewsForNew")}{numberField("maxLearningCardsForNew")}</>}
        </Panel>
        <View style={{ flexDirection: "row", gap: 10, padding: 16, borderRadius: 18, backgroundColor: theme.colors.secondaryContainer }}>
          <Icon source="information-outline" size={22} color={theme.colors.secondary} />
          <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSecondaryContainer, lineHeight: 19 }}>Изменения применятся после сохранения. Уже назначенные даты повторений сохранятся; новые интервалы будут рассчитаны при следующем ответе. При смене начала дня статистика пересчитывается.</Text>
        </View>
        {!!error && <HelperText type="error" visible accessibilityLiveRegion="polite">{error}</HelperText>}
        <Button mode="contained" icon="check" loading={saving} disabled={saving || !dirty} onPress={() => void save()} contentStyle={{ minHeight: 52 }}>
          {dirty ? "Сохранить настройки" : "Настройки сохранены"}
        </Button>
        <Button mode="text" disabled={saving} icon="restore" onPress={reset}>Исходные значения</Button>
      </ScrollView>
    </KeyboardAvoidingView>
    <Snackbar visible={!!message} onDismiss={() => setMessage("")}>{message}</Snackbar>
  </SectionScreen>;
}

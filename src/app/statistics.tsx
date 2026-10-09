import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { ActivityIndicator, Button, Chip, Icon, ProgressBar, Snackbar, Text, TouchableRipple } from "react-native-paper";
import SectionScreen, { Panel, SectionHeading } from "@/components/SectionScreen";
import { ActivityCalendar, ActivityChart } from "@/components/StatisticsCharts";
import { Stars } from "@/components/PatriotBrand";
import { getStatistics } from "@/db/repositories/statisticsRepository";
import type { StudyStatistics } from "@/db/queries/statistics";
import { useForegroundEffect } from "@/hooks/useForegroundEffect";
import { activityDays, dateFromKey, summarizeActivity } from "@/lib/statistics";
import { ratings } from "@/lib/scheduler";
import { formatDayStart } from "@/lib/settings";
import { useAppStore } from "@/store";
import { useAppTheme } from "@/theme";

export default function StatisticsScreen() {
  const theme = useAppTheme();
  const settings = useAppStore((state) => state.settings);
  const decks = useAppStore((state) => state.decks);
  const overview = useAppStore((state) => state.overview);
  const refresh = useAppStore((state) => state.refresh);
  const [data, setData] = useState<StudyStatistics | null>(null);
  const [period, setPeriod] = useState(7);
  const [selectedDay, setSelectedDay] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useForegroundEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        const [statistics] = await Promise.all([getStatistics(), refresh()]);
        if (active) { setData(statistics); setError(""); }
      } catch {
        if (active) setError("Не удалось загрузить статистику. Попробуйте ещё раз.");
      } finally {
        if (active) timer = setTimeout(() => void update(), 30_000);
      }
    };
    void update();
    return () => { active = false; clearTimeout(timer); };
  }, [refresh]), retry);

  const days = useMemo(() => data ? activityDays(data.history, 90, new Date(data.now), settings.dayStartHour) : [], [data, settings.dayStartHour]);
  const totals = summarizeActivity(days.slice(-period));
  const calendar = days.slice(-84);
  const selected = calendar.find((day) => day.day === selectedDay) ?? days.at(-1);
  const distribution = days.slice(-period).reduce((sum, day) => [sum[0] + day.again, sum[1] + day.hard, sum[2] + day.good, sum[3] + day.easy], [0, 0, 0, 0]);
  const ratingColors = theme.ratings.map((rating) => rating.color);

  return <SectionScreen active="statistics">
    {!data ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
      {error ? <><Text style={{ textAlign: "center" }}>{error}</Text><Button mode="contained" onPress={() => setRetry((value) => value + 1)}>Повторить</Button></> : <ActivityIndicator />}
    </View> : <ScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 32 }}>
      <SectionHeading title="Статистика" icon="chart-box-outline" caption="Маленькие шаги складываются в большой словарный запас. Вот ваш путь в цифрах." />
      <View style={{ backgroundColor: theme.colors.hero, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.heroBorder }}>
        <View style={{ padding: 24, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon source="star-circle-outline" size={24} color={theme.colors.onHero} />
              <Text variant="labelLarge" style={{ color: theme.colors.onHero, letterSpacing: 1.4, fontWeight: "800" }}>ВАША СЕРИЯ</Text>
            </View>
            <Stars size={10} color={theme.colors.heroMuted} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "baseline" }}>
            <Text style={{ fontSize: 64, lineHeight: 72, fontWeight: "900", color: theme.colors.onHero }}>{data.streaks.current}</Text>
            <Text variant="titleMedium" style={{ color: theme.colors.heroMuted }}>дн. подряд</Text>
          </View>
          <Text variant="bodyMedium" style={{ color: theme.colors.onHero, lineHeight: 22 }}>{data.streaks.current ? "Регулярность помогает памяти. Продолжайте в своём темпе." : "Начните с одной карточки сегодня — и появится первая отметка."}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, paddingTop: 16, borderTopWidth: 1, borderColor: theme.colors.heroBorder }}>
            <Text variant="labelMedium" style={{ color: theme.colors.heroMuted }}>Рекорд: {data.streaks.best} дн.</Text>
            <Text variant="labelMedium" style={{ color: theme.colors.heroMuted }}>Всего ответов: {data.lifetime.answers}</Text>
          </View>
        </View>
        <View accessible={false} style={{ gap: 4, backgroundColor: theme.colors.onHero }}>
          {[0, 1].map((stripe) => <View key={stripe} style={{ height: 4, backgroundColor: theme.colors.accent }} />)}
        </View>
      </View>
      {!data.lifetime.answers && <View style={{ gap: 12, padding: 20, borderRadius: 20, backgroundColor: theme.colors.secondaryContainer }}>
        <Text variant="titleMedium" style={{ fontWeight: "700" }}>Каждый ответ имеет значение</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer }}>Добавьте коллекцию и начните практику. Здесь появятся ваша активность, успешность повторений и серия занятий.</Text>
        <Button mode="contained-tonal" onPress={() => router.replace("/")}>К коллекциям</Button>
      </View>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[7, 30, 90].map((count) => <Chip key={count} selected={period === count} showSelectedCheck={false} onPress={() => setPeriod(count)}
          accessibilityLabel={`Статистика за ${count} дней`} style={{ flex: 1, backgroundColor: period === count ? theme.colors.primaryContainer : theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: period === count ? theme.colors.primary : theme.colors.outlineVariant }} textStyle={{ textAlign: "center", fontSize: 12, fontWeight: "700", color: period === count ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginHorizontal: 6 }}>{count} дней</Chip>)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Metric value={String(totals.answers)} label="ответов" icon="cards-outline" />
        <Metric value={totals.recallRate === null ? "—" : `${totals.recallRate}%`} label="вспомнили" icon="brain" accent />
        <Metric value={String(totals.introduced)} label="новых значений" icon="star-outline" accent />
        <Metric value={`${totals.activeDays}/${period}`} label="дней с практикой" icon="calendar-check-outline" />
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>«Вспомнили» — доля обычных повторений без оценки «Снова». Новые значения и короткие закрепления в этот показатель не входят.</Text>
      <Panel title="Сегодня в вашем темпе" icon="target">
        <DailyGoal label="Новые значения" done={overview?.introducedToday ?? 0} limit={settings.newCardsPerDay} color={theme.colors.primary} />
        <DailyGoal label="Обычные повторения" done={overview?.reviewedToday ?? 0} limit={settings.reviewsPerDay} color={theme.colors.accent} />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Учебный день начинается в {formatDayStart(settings.dayStartHour)}. Лимиты общие для всех коллекций.</Text>
        {!!overview?.queue.length && <Button mode="contained" icon="arrow-right" onPress={() => router.push("/study/all")}>Продолжить практику</Button>}
      </Panel>
      <Panel title="Ритм последней недели" icon="chart-bar">
        <ActivityChart days={days.slice(-7).map((day) => ({ day: day.day, count: day.answers }))} />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Все ответы, включая закрепления одного значения.</Text>
      </Panel>
      <Panel title="12 недель практики" icon="calendar-month-outline">
        <ActivityCalendar days={calendar} selected={selected?.day ?? ""} onSelect={setSelectedDay} />
        {selected && <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceVariant, gap: 4 }}>
          <Text variant="labelLarge">{dateFromKey(selected.day).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Ответов: {selected.answers} · новых значений: {selected.introduced}</Text>
        </View>}
      </Panel>
      <Panel title="Как вы отвечаете" icon="gesture-tap-button">
        <View style={{ flexDirection: "row", height: 12, borderRadius: 8, overflow: "hidden", backgroundColor: theme.colors.surfaceVariant }}>
          {distribution.map((count, index) => count > 0 ? <View key={index} style={{ flex: count, backgroundColor: ratingColors[index] }} /> : null)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {ratings.map((rating, index) => <View key={rating.value} style={{ flexBasis: "45%", flexGrow: 1, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text variant="bodyMedium" style={{ color: ratingColors[index] }}>{rating.label}</Text><Text variant="titleSmall">{distribution[index]}</Text>
          </View>)}
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Все оценки за выбранные {period} дней.</Text>
      </Panel>
      <Panel title="Ваш словарный запас" icon="book-open-page-variant-outline">
        <Text variant="headlineMedium" style={{ fontWeight: "800" }}>{data.vocabulary.total - data.vocabulary.fresh} <Text variant="bodyMedium">из {data.vocabulary.total} значений знакомы</Text></Text>
        {[
          { label: "Ещё не изучены", count: data.vocabulary.fresh, color: theme.colors.outline },
          { label: "На коротких шагах", count: data.vocabulary.learning, color: theme.colors.accent },
          { label: "На повторении", count: data.vocabulary.young, color: theme.colors.primary },
          { label: "Устойчивые", count: data.vocabulary.mature, color: theme.colors.positive },
        ].map((item) => <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} /><Text style={{ flex: 1 }}>{item.label}</Text><Text variant="titleSmall">{item.count}</Text>
        </View>)}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Только подписанные коллекции. «Устойчивые» — значения со стабильностью FSRS от 21 дня; это оценка памяти, а не гарантия.</Text>
      </Panel>
      <Panel title="Нагрузка на ближайшую неделю" icon="calendar-clock-outline">
        <ActivityChart days={data.forecast} forecast />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>Значения по текущим датам FSRS, без дневного ограничения. Сегодня включает просроченные. Новые ответы могут изменить прогноз.</Text>
      </Panel>
      {!!data.difficult.length && <Panel title="Требуют внимания" icon="lightbulb-on-outline">
        {data.difficult.map((item) => <TouchableRipple key={item.id} onPress={() => router.push(`/deck/${item.deckId}`)} accessibilityRole="button" accessibilityLabel={`Открыть коллекцию слова ${item.word}`}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 6 }}>
            <View style={{ flex: 1, gap: 4 }}><Text variant="titleMedium" style={{ fontWeight: "700" }}>{item.word}</Text><Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.hint || item.translation}</Text></View>
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>{item.lapses} забываний</Text>
          </View>
        </TouchableRipple>)}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Забывания после перехода к обычным повторениям, за всё время.</Text>
      </Panel>}
      <Panel title="Прогресс по коллекциям" icon="cards-outline">
        {decks.filter((deck) => deck.added || deck.studiedMeaningCount > 0).map((deck) => <TouchableRipple key={deck.id} onPress={() => router.push(`/deck/${deck.id}`)} accessibilityRole="button" accessibilityLabel={`Прогресс коллекции ${deck.name}`}>
          <View style={{ gap: 8, paddingVertical: 6 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Text variant="titleSmall" style={{ flex: 1 }}>{deck.name}</Text><Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{deck.added ? "Изучается" : "На паузе"}</Text></View>
            <ProgressBar progress={deck.meaningCount ? deck.studiedMeaningCount / deck.meaningCount : 0} color={theme.colors.primary} style={{ height: 6, borderRadius: 6, backgroundColor: theme.colors.surfaceVariant }} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{deck.studiedMeaningCount} / {deck.meaningCount} знакомых значений</Text>
          </View>
        </TouchableRipple>)}
        {!decks.some((deck) => deck.added || deck.studiedMeaningCount) && <Text style={{ color: theme.colors.onSurfaceVariant }}>Выберите первую коллекцию — здесь появится её прогресс.</Text>}
      </Panel>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", lineHeight: 18 }}>История активности включает коллекции, от которых вы отписались. Все данные хранятся на этом устройстве.</Text>
    </ScrollView>}
    {data && <Snackbar visible={!!error} onDismiss={() => setError("")} action={{ label: "Повторить", onPress: () => setRetry((value) => value + 1) }}>{error}</Snackbar>}
  </SectionScreen>;
}

function Metric({ value, label, icon, accent = false }: { value: string; label: string; icon: string; accent?: boolean }) {
  const theme = useAppTheme();
  return <View style={{ flexBasis: "45%", flexGrow: 1, padding: 18, borderRadius: 18, gap: 8, borderWidth: 1, borderColor: accent ? theme.colors.accentContainer : theme.colors.outlineVariant, backgroundColor: accent ? theme.colors.accentContainer : theme.colors.surface }}>
    <Icon source={icon} size={22} color={accent ? theme.colors.onAccentContainer : theme.colors.primary} />
    <Text variant="headlineMedium" style={{ fontWeight: "800", color: accent ? theme.colors.onAccentContainer : theme.colors.onSurface }}>{value}</Text>
    <Text variant="bodySmall" style={{ color: accent ? theme.colors.onAccentContainer : theme.colors.onSurfaceVariant }}>{label}</Text>
  </View>;
}

function DailyGoal({ label, done, limit, color }: { label: string; done: number; limit: number; color: string }) {
  const theme = useAppTheme();
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", gap: 12 }}><Text variant="bodyMedium" style={{ flex: 1 }}>{label}</Text><Text variant="labelLarge">{limit ? `${done} / ${limit}` : "Отключены"}</Text></View>
    <ProgressBar progress={limit ? Math.min(1, done / limit) : 0} color={color} style={{ height: 8, borderRadius: 8, backgroundColor: theme.colors.surfaceVariant }} />
  </View>;
}

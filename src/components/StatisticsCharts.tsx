import { View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import { dateFromKey, type DailyActivity } from "@/lib/statistics";
import { theme } from "@/theme";

export function ActivityChart({ days, forecast = false }: { days: { day: string; count: number }[]; forecast?: boolean }) {
  const maximum = Math.max(1, ...days.map((day) => day.count));
  return <View style={{ flexDirection: "row", gap: 8 }}>
    {days.map((day, index) => <View key={day.day} style={{ flex: 1, alignItems: "center", gap: 8 }}
      accessible accessibilityLabel={`${dateFromKey(day.day).toLocaleDateString("ru-RU")}: ${day.count} ${forecast ? "значений к повторению" : "ответов"}`}>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{day.count}</Text>
      <View style={{ height: 96, width: "100%", justifyContent: "flex-end" }}>
        <View style={{ height: day.count ? Math.max(8, day.count / maximum * 96) : 3, borderRadius: 8,
          backgroundColor: day.count ? (forecast ? theme.colors.secondary : index === days.length - 1 ? theme.colors.primary : "#C3B7E3") : theme.colors.outlineVariant }} />
      </View>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{forecast && index === 0 ? "Сег." : dateFromKey(day.day).toLocaleDateString("ru-RU", { weekday: "short" })}</Text>
    </View>)}
  </View>;
}

const heatColors = ["#EFEDF4", "#DED5EF", "#BCA9DD", "#9479C2", "#6250A6"];

export function ActivityCalendar({ days, selected, onSelect }: { days: DailyActivity[]; selected: string; onSelect: (day: string) => void }) {
  const max = Math.max(1, ...days.map((day) => day.answers));
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: 12 }, (_, week) => <View key={week} style={{ flex: 1, gap: 4 }}>
        {days.slice(week * 7, week * 7 + 7).map((day) => {
          const color = heatColors[day.answers ? Math.min(4, Math.ceil(day.answers / max * 4)) : 0];
          return <TouchableRipple key={day.day} onPress={() => onSelect(day.day)}
            accessibilityRole="button" accessibilityState={{ selected: selected === day.day }} aria-pressed={selected === day.day}
            accessibilityLabel={`${dateFromKey(day.day).toLocaleDateString("ru-RU")}, ответов: ${day.answers}`}
            style={{ borderRadius: 4, overflow: "hidden" }}>
            <View style={{ width: "100%", aspectRatio: 1, backgroundColor: color, borderRadius: 4,
              borderWidth: selected === day.day ? 2 : 0, borderColor: theme.colors.onPrimaryContainer }} />
          </TouchableRipple>;
        })}
      </View>)}
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginRight: 4 }}>Меньше</Text>
      {heatColors.map((color) => <View key={color} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />)}
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 4 }}>Больше</Text>
    </View>
  </View>;
}

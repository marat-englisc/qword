import { View } from "react-native";
import { router } from "expo-router";
import { Icon, Text, TouchableRipple } from "react-native-paper";
import { useAppTheme } from "@/theme";

const sections = [
  { key: "collections", label: "Коллекции", icon: "cards-outline", route: "/" },
  { key: "statistics", label: "Статистика", icon: "chart-box-outline", route: "/statistics" },
  { key: "settings", label: "Настройки", icon: "tune-variant", route: "/settings" },
] as const;

export default function AppNavigation({ active }: { active: typeof sections[number]["key"] }) {
  const theme = useAppTheme();
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
      <View style={{ flexDirection: "row", width: "100%", maxWidth: 620, alignSelf: "center", paddingVertical: 8 }}>
        {sections.map((section) => {
          const selected = section.key === active;
          return (
            <TouchableRipple key={section.key} onPress={() => { if (!selected) router.replace(section.route); }}
              accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} accessibilityLabel={section.label}
              style={{ flex: 1, borderRadius: 16, marginHorizontal: 4, borderTopWidth: 2, borderTopColor: selected ? theme.colors.accent : "transparent" }}>
              <View style={{ alignItems: "center", gap: 4, paddingVertical: 6 }}>
                <View style={{ paddingHorizontal: 20, paddingVertical: 4, borderRadius: 12, backgroundColor: selected ? theme.colors.primaryContainer : "transparent" }}>
                  <Icon source={section.icon} size={23} color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant} />
                </View>
                <Text variant="labelMedium" style={{ color: selected ? theme.colors.primary : theme.colors.onSurfaceVariant, fontWeight: selected ? "700" : "500" }}>{section.label}</Text>
              </View>
            </TouchableRipple>
          );
        })}
      </View>
    </View>
  );
}

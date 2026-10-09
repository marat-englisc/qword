import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, Text } from "react-native-paper";
import AppNavigation from "./AppNavigation";
import { useAppTheme } from "@/theme";
import { Stars } from "./PatriotBrand";

export default function SectionScreen({ active, children }: { active: "settings" | "statistics"; children: ReactNode }) {
  const theme = useAppTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <View style={{ flex: 1, width: "100%", maxWidth: 620, alignSelf: "center" }}>{children}</View>
    <AppNavigation active={active} />
  </SafeAreaView>;
}

export function SectionHeading({ title, caption, icon }: { title: string; caption: string; icon: string }) {
  const theme = useAppTheme();
  return <View style={{ gap: 10, paddingTop: 8, paddingBottom: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon source={icon} size={18} color={theme.colors.accent} />
        <Text variant="labelSmall" style={{ letterSpacing: 2, color: theme.colors.primary, fontWeight: "800" }}>QWORD / ENGLISH CLUB</Text>
      </View>
      <Stars size={9} />
    </View>
    <Text variant="headlineLarge" style={{ fontWeight: "900", letterSpacing: -0.7 }}>{title}</Text>
    <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 24 }}>{caption}</Text>
  </View>;
}

export function Panel({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  const theme = useAppTheme();
  return <View style={{ backgroundColor: theme.colors.surface, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.outlineVariant, padding: 20, gap: 16 }}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <View style={{ backgroundColor: theme.colors.primaryContainer, padding: 7, borderRadius: 10 }}><Icon source={icon} size={20} color={theme.colors.primary} /></View>
      <Text variant="titleMedium" style={{ fontWeight: "700", flex: 1 }}>{title}</Text>
    </View>
    {children}
  </View>;
}

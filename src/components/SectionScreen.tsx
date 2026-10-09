import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, Text } from "react-native-paper";
import AppNavigation from "./AppNavigation";
import { theme } from "@/theme";

export default function SectionScreen({ active, children }: { active: "settings" | "statistics"; children: ReactNode }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <View style={{ flex: 1, width: "100%", maxWidth: 620, alignSelf: "center" }}>{children}</View>
    <AppNavigation active={active} />
  </SafeAreaView>;
}

export function SectionHeading({ title, caption, icon }: { title: string; caption: string; icon: string }) {
  return <View style={{ gap: 10, paddingTop: 8, paddingBottom: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon source={icon} size={20} color={theme.colors.primary} />
      <Text variant="labelLarge" style={{ letterSpacing: 2, color: theme.colors.primary }}>QWORD / {title.toUpperCase()}</Text>
    </View>
    <Text variant="headlineLarge" style={{ fontWeight: "800" }}>{title}</Text>
    <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 24 }}>{caption}</Text>
  </View>;
}

export function Panel({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return <View style={{ backgroundColor: theme.colors.surface, borderRadius: 24, padding: 20, gap: 16 }}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <Icon source={icon} size={22} color={theme.colors.primary} />
      <Text variant="titleMedium" style={{ fontWeight: "700", flex: 1 }}>{title}</Text>
    </View>
    {children}
  </View>;
}

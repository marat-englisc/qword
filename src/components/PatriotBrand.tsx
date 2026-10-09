import { View } from "react-native";
import { Icon } from "react-native-paper";
import { useAppTheme } from "@/theme";

export function Stars({
  color,
  size = 11,
  count = 3,
}: {
  color?: string;
  size?: number;
  count?: number;
}) {
  const theme = useAppTheme();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Icon
          key={index}
          source="star"
          color={color ?? theme.colors.primary}
          size={size}
        />
      ))}
    </View>
  );
}

export function FlagStripe({ height = 6 }: { height?: number }) {
  const theme = useAppTheme();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{ flexDirection: "row", height }}
    >
      <View style={{ flex: 3, backgroundColor: theme.colors.accent }} />
      <View style={{ flex: 1, backgroundColor: theme.colors.star }} />
      <View style={{ flex: 2, backgroundColor: theme.colors.hero }} />
    </View>
  );
}

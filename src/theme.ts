import { MD3LightTheme } from "react-native-paper";

export const theme = {
  ...MD3LightTheme,
  roundness: 5,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#6250A6",
    onPrimary: "#FFFFFF",
    primaryContainer: "#EDE7FA",
    onPrimaryContainer: "#35285D",
    secondary: "#38766A",
    secondaryContainer: "#E4F1EA",
    onSecondaryContainer: "#244F45",
    background: "#F8F7F3",
    surface: "#FFFFFF",
    surfaceVariant: "#F0EDE6",
    onSurface: "#252A29",
    onSurfaceVariant: "#6E736F",
    outline: "#AAA9A1",
    outlineVariant: "#E6E5DE",
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: "#FFFFFF",
      level2: "#F3F0FA",
    },
  },
};

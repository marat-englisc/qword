import { MD3DarkTheme, MD3LightTheme, useTheme, type MD3Theme } from "react-native-paper";

type BrandColors = {
  hero: string; onHero: string; heroMuted: string; heroBorder: string;
  accent: string; onAccent: string; accentContainer: string; onAccentContainer: string;
  star: string; positive: string; positiveContainer: string; onPositiveContainer: string;
  heatmap: string[];
};
export type AppTheme = MD3Theme & {
  colors: MD3Theme["colors"] & BrandColors;
  ratings: { color: string; background: string }[];
};

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  roundness: 5,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#183D72", onPrimary: "#FFFFFF",
    primaryContainer: "#E7EEF9", onPrimaryContainer: "#102C55",
    secondary: "#BA283C", onSecondary: "#FFFFFF",
    secondaryContainer: "#FCE9EC", onSecondaryContainer: "#852338",
    tertiary: "#94631C", onTertiary: "#FFFFFF",
    tertiaryContainer: "#FFF1D5", onTertiaryContainer: "#65430D",
    background: "#F4F6FA", onBackground: "#142641",
    surface: "#FFFFFF", surfaceVariant: "#EAF0F8",
    onSurface: "#142641", onSurfaceVariant: "#52627A",
    outline: "#8796AD", outlineVariant: "#DAE2EE",
    error: "#AF2337", onError: "#FFFFFF",
    errorContainer: "#FCE6EA", onErrorContainer: "#751627",
    surfaceDisabled: "rgba(20,38,65,0.08)", onSurfaceDisabled: "rgba(20,38,65,0.42)",
    inverseSurface: "#142641", inverseOnSurface: "#F1F5FC", inversePrimary: "#B4CEFF",
    backdrop: "rgba(5,15,33,0.55)",
    hero: "#102449", onHero: "#FFFFFF", heroMuted: "#BCCDE8", heroBorder: "#35517A",
    accent: "#C72D43", onAccent: "#FFFFFF",
    accentContainer: "#FCE9EC", onAccentContainer: "#8E2537", star: "#FFFFFF",
    positive: "#24558A", positiveContainer: "#E5F0FF", onPositiveContainer: "#163F70",
    heatmap: ["#EAF0F8", "#C9D9F2", "#92B2E1", "#537FBB", "#183D72"],
    elevation: { level0: "transparent", level1: "#FFFFFF", level2: "#F3F6FC", level3: "#EBF1FA", level4: "#E6EDF8", level5: "#E0E9F6" },
  },
  ratings: [
    { color: "#AF2337", background: "#FCE9EC" },
    { color: "#865D18", background: "#FFF1D5" },
    { color: "#183D72", background: "#E7EEF9" },
    { color: "#24558A", background: "#E5F0FF" },
  ],
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  roundness: 5,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#B4CEFF", onPrimary: "#0B254B",
    primaryContainer: "#243F65", onPrimaryContainer: "#DEE9FF",
    secondary: "#FF91A1", onSecondary: "#581325",
    secondaryContainer: "#4A2031", onSecondaryContainer: "#FFDCE2",
    tertiary: "#EDC887", onTertiary: "#3D2B0C",
    tertiaryContainer: "#46371D", onTertiaryContainer: "#FCE2B6",
    background: "#080F1E", onBackground: "#F0F4FC",
    surface: "#121E32", surfaceVariant: "#1D2C45",
    onSurface: "#F0F4FC", onSurfaceVariant: "#ADBCD2",
    outline: "#74849D", outlineVariant: "#2A3B56",
    error: "#FFA4AF", onError: "#650C22",
    errorContainer: "#501C2C", onErrorContainer: "#FFDCE2",
    surfaceDisabled: "rgba(240,244,252,0.10)", onSurfaceDisabled: "rgba(240,244,252,0.42)",
    inverseSurface: "#E5ECF8", inverseOnSurface: "#142641", inversePrimary: "#183D72",
    backdrop: "rgba(0,4,14,0.72)",
    hero: "#162E53", onHero: "#FFFFFF", heroMuted: "#BECEE8", heroBorder: "#36527A",
    accent: "#E64760", onAccent: "#FFFFFF",
    accentContainer: "#4A2031", onAccentContainer: "#FFBCC6", star: "#FFFFFF",
    positive: "#8DBDF4", positiveContainer: "#1D3555", onPositiveContainer: "#C9E2FF",
    heatmap: ["#1D2C45", "#2F496F", "#426595", "#628CBF", "#A7C9FA"],
    elevation: { level0: "transparent", level1: "#16243A", level2: "#1B2B43", level3: "#20304A", level4: "#243550", level5: "#293C58" },
  },
  ratings: [
    { color: "#FFAFBA", background: "#4A2031" },
    { color: "#EDC887", background: "#46371D" },
    { color: "#B4CEFF", background: "#243F65" },
    { color: "#C9E2FF", background: "#1D3555" },
  ],
};

export const useAppTheme = () => useTheme<AppTheme>();

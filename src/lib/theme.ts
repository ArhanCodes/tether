import { Platform } from "react-native";

// Apple system font stack — uses SF Pro on iOS/macOS, falls back gracefully elsewhere
export const SYSTEM_FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
}) as string;

// iOS-inspired color palette (keeping the blue + white identity)
export const colors = {
  // iOS system blue
  primary: "#007AFF",
  primaryDark: "#0051D5",
  primaryLight: "#64B5F6",
  primarySoft: "#E5F0FF",

  // iOS system grays
  bgGrouped: "#F2F2F7", // iOS grouped table background
  bgCard: "#FFFFFF",
  bgHover: "#F9F9FB",
  separator: "#E5E5EA",
  separatorStrong: "#D1D1D6",

  // Text
  label: "#1C1C1E",
  labelSecondary: "#3C3C43",
  labelTertiary: "#8E8E93",
  labelQuaternary: "#C7C7CC",

  // Semantic
  success: "#34C759",
  warning: "#FF9500",
  danger: "#FF3B30",
  dangerSoft: "#FFEBEA",
  warningSoft: "#FFF4E0",
  successSoft: "#E3F9E5",

  // Accent
  accent: "#5856D6",
};

// iOS-style radii
export const radius = {
  small: 8,
  medium: 12,
  large: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

// Apple prefers subtle, diffused shadows
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
  }),
  floating: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
  }),
};

// Text style preset getters
export const text = {
  largeTitle: { fontFamily: SYSTEM_FONT, fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.5 },
  title1: { fontFamily: SYSTEM_FONT, fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  title2: { fontFamily: SYSTEM_FONT, fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  title3: { fontFamily: SYSTEM_FONT, fontSize: 20, fontWeight: "600" as const },
  headline: { fontFamily: SYSTEM_FONT, fontSize: 17, fontWeight: "600" as const },
  body: { fontFamily: SYSTEM_FONT, fontSize: 17, fontWeight: "400" as const },
  callout: { fontFamily: SYSTEM_FONT, fontSize: 16, fontWeight: "400" as const },
  subhead: { fontFamily: SYSTEM_FONT, fontSize: 15, fontWeight: "400" as const },
  footnote: { fontFamily: SYSTEM_FONT, fontSize: 13, fontWeight: "400" as const },
  caption1: { fontFamily: SYSTEM_FONT, fontSize: 12, fontWeight: "400" as const },
  caption2: { fontFamily: SYSTEM_FONT, fontSize: 11, fontWeight: "400" as const },
};

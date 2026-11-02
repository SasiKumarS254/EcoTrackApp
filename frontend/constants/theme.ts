// EcoTrack Design System — Centralized Theme
export const LightColors = {
  primary: "#10b981",
  primaryDark: "#059669",
  primaryLight: "#ecfdf5",
  secondary: "#0ea5e9",
  accent: "#3b82f6",
  danger: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",
  purple: "#8b5cf6",

  bgLight: "#f8fafc",
  bgCard: "#ffffff",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
};

export const DarkColors = {
  primary: "#10b981",
  primaryDark: "#059669",
  primaryLight: "#064e3b",
  secondary: "#0ea5e9",
  accent: "#3b82f6",
  danger: "#ef4444",
  success: "#10b981",
  warning: "#f59e0b",
  purple: "#8b5cf6",

  bgLight: "#0b0f19",
  bgCard: "#111827",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  border: "#1f2937",
};

// Fallback for components not yet converted to useTheme
export const Colors = LightColors;

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 16, lg: 24, xl: 32, full: 999,
};

export const FontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 26, xxxl: 32,
};

export const Shadow = {
  sm: { elevation: 2, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4 },
  md: { elevation: 5, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8 },
  lg: { elevation: 10, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14 },
};

// Conservation Status colors (for the animal dataset)
export const ConservationColors: Record<string, string> = {
  LC: "#10b981",
  NT: "#84cc16",
  VU: "#f59e0b",
  EN: "#f97316",
  CR: "#ef4444",
  EX: "#6b7280",
};

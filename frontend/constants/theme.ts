// EcoTrack Design System — Centralized Theme
export const LightColors = {
  primary: "#16a34a",
  primaryDark: "#15803d",
  primaryLight: "#86efac",
  secondary: "#0ea5e9",
  accent: "#f59e0b",
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#f97316",
  purple: "#8b5cf6",
  
  bgLight: "#f0fdf4",
  bgCard: "#ffffff",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
};

export const DarkColors = {
  primary: "#16a34a",
  primaryDark: "#14532d",
  primaryLight: "#4ade80",
  secondary: "#38bdf8",
  accent: "#fbbf24",
  danger: "#f87171",
  success: "#4ade80",
  warning: "#fb923c",
  purple: "#a78bfa",
  
  bgLight: "#0f172a", // Dark bg
  bgCard: "#1e293b", // Dark card
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  border: "#334155",
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
  LC: "#22c55e",
  NT: "#84cc16",
  VU: "#f59e0b",
  EN: "#f97316",
  CR: "#ef4444",
  EX: "#6b7280",
};

import type { LenderTheme } from "@/server/mock/types";

export const DEFAULT_BRAND_THEME: Readonly<LenderTheme> = {
  brandPrimary: "#0466c8",
  brandDark: "#044b95",
  brandMuted: "#d4e4fb",
  brandLight: "#eef6ff",
  colorMode: "light",
  themeKey: "qualtech",
  bgPattern: "clean",
  density: "comfortable",
};

export interface ThemePreset {
  id: string;
  name: string;
  dotColor: string;
  description: string;
  theme: LenderTheme;
}

export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  {
    id: "qualtech",
    name: "QualtechEdge Brand",
    dotColor: "#0466c8",
    description: "Qualtech enterprise signature blue & crisp ice highlights",
    theme: {
      brandPrimary: "#0466c8",
      brandDark: "#044b95",
      brandMuted: "#d4e4fb",
      brandLight: "#eef6ff",
      themeKey: "qualtech",
    },
  },
  {
    id: "enterprise-blue",
    name: "Enterprise Blue",
    dotColor: "#2563eb",
    description: "High-contrast dynamic royal blue suited for high-density operations",
    theme: {
      brandPrimary: "#2563eb",
      brandDark: "#1d4ed8",
      brandMuted: "#dbeafe",
      brandLight: "#eff6ff",
      themeKey: "enterprise-blue",
    },
  },
  {
    id: "navy-pro",
    name: "Navy Professional",
    dotColor: "#0e7490",
    description: "Deep oceanic teal and cyan accents for executive clarity",
    theme: {
      brandPrimary: "#0e7490",
      brandDark: "#155e75",
      brandMuted: "#cffafe",
      brandLight: "#ecfeff",
      themeKey: "navy-pro",
    },
  },
  {
    id: "modern-purple",
    name: "Modern Purple",
    dotColor: "#7c3aed",
    description: "Sleek vibrant violet and lavender gradients for contemporary fintech UI",
    theme: {
      brandPrimary: "#7c3aed",
      brandDark: "#5b21b6",
      brandMuted: "#ede9fe",
      brandLight: "#f5f3ff",
      themeKey: "modern-purple",
    },
  },
  {
    id: "emerald-green",
    name: "Emerald Green",
    dotColor: "#059669",
    description: "Fresh forest emerald & mint tones representing financial stability",
    theme: {
      brandPrimary: "#059669",
      brandDark: "#047857",
      brandMuted: "#d1fae5",
      brandLight: "#ecfdf5",
      themeKey: "emerald-green",
    },
  },
  {
    id: "minimal-gray",
    name: "Minimal Gray",
    dotColor: "#475569",
    description: "Neutral slate and monochromatic steel tones for focused analytics",
    theme: {
      brandPrimary: "#475569",
      brandDark: "#334155",
      brandMuted: "#e2e8f0",
      brandLight: "#f8fafc",
      themeKey: "minimal-gray",
    },
  },
  {
    id: "soft-coaching",
    name: "Soft Coaching",
    dotColor: "#a855f7",
    description: "Warm lilac and pastel purple with calm focus states",
    theme: {
      brandPrimary: "#a855f7",
      brandDark: "#7e22ce",
      brandMuted: "#f3e8ff",
      brandLight: "#faf5ff",
      themeKey: "soft-coaching",
    },
  },
  {
    id: "warm-orange",
    name: "Warm Orange",
    dotColor: "#ea580c",
    description: "IMGC classic energetic orange & warm peach tints",
    theme: {
      brandPrimary: "#ea580c",
      brandDark: "#c2410c",
      brandMuted: "#ffedd5",
      brandLight: "#fff7ed",
      themeKey: "warm-orange",
    },
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    dotColor: "#e11d48",
    description: "Rich ruby crimson and subtle blush rose tones",
    theme: {
      brandPrimary: "#e11d48",
      brandDark: "#be123c",
      brandMuted: "#ffe4e6",
      brandLight: "#fff1f2",
      themeKey: "rose-gold",
    },
  },
  {
    id: "glass-enterprise",
    name: "Glass Enterprise",
    dotColor: "#0284c7",
    description: "Airy sky blue and translucent glass tones for futuristic dashboards",
    theme: {
      brandPrimary: "#0284c7",
      brandDark: "#0369a1",
      brandMuted: "#e0f2fe",
      brandLight: "#f0f9ff",
      themeKey: "glass-enterprise",
    },
  },
];

export interface BgPreset {
  id: string;
  name: string;
  description: string;
  styleClass: string;
}

export const BG_PRESETS: ReadonlyArray<BgPreset> = [
  {
    id: "clean",
    name: "Clean Canvas",
    description: "Pure crisp background with subtle neutral borders",
    styleClass: "bg-neutral-50/60",
  },
  {
    id: "subtle",
    name: "Subtle Gradient",
    description: "Gentle brand-tinted radial gradient for subtle depth",
    styleClass: "bg-gradient-to-b from-brand-light/30 via-white to-neutral-50",
  },
  {
    id: "mesh",
    name: "Mesh Glow",
    description: "Dynamic multi-point gradient mesh for modern glass feel",
    styleClass: "bg-radial-[at_top_right] from-brand-light/40 via-neutral-50 to-white",
  },
  {
    id: "glass",
    name: "Glass Backdrop",
    description: "Frosted translucent surfaces with soft ambient drop",
    styleClass: "bg-white/80 backdrop-blur-md",
  },
  {
    id: "dark-slate",
    name: "Deep Slate",
    description: "Dark mode optimized slate canvas for high-contrast telemetry",
    styleClass: "bg-slate-900 text-slate-100",
  },
];

export interface LanguageOption {
  code: string;
  nativeName: string;
  englishName: string;
}

export const LANGUAGE_OPTIONS: ReadonlyArray<LanguageOption> = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "hi", nativeName: "हिंदी", englishName: "Hindi" },
  { code: "ta", nativeName: "தமிழ்", englishName: "Tamil" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu" },
  { code: "ml", nativeName: "മലയാളം", englishName: "Malayalam" },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "zh", nativeName: "中文", englishName: "Chinese" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic" },
];

export const DENSITY_OPTIONS = [
  { id: "compact", label: "Compact — maximum information density", name: "Compact" },
  { id: "comfortable", label: "Comfortable — standard spacing", name: "Comfortable" },
  { id: "executive", label: "Executive — roomier, larger text", name: "Executive" },
  { id: "presentation", label: "Presentation — largest, for screens/projectors", name: "Presentation" },
] as const;

export const COLOR_MODE_OPTIONS = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "laptop" },
] as const;

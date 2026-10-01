/* eslint-disable no-restricted-syntax, react-perf/jsx-no-new-function-as-prop, security/detect-object-injection -- previews render the colours being edited (user data, not design colours); the handlers close over per-row state; keys are the fixed theme-field names. */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  LaptopIcon,
  LockIcon,
  MoonIcon,
  RotateCcwIcon,
  SunIcon,
  Trash2Icon,
  UploadCloudIcon,
  SearchIcon,
  BellIcon,
  BotIcon,
  ShieldCheckIcon,
  BuildingIcon,
} from "lucide-react";

import {
  THEME_PRESETS,
  DENSITY_OPTIONS,
  COLOR_MODE_OPTIONS,
  DEFAULT_BRAND_THEME,
  type ThemePreset,
} from "@imgc/constants/branding";
import type {
  LenderBrandingData,
  UserPersonalizationData,
} from "@imgc/data/services/portal/brandingConfig.server";
import type { LenderCustomColors } from "@imgc/types/domain";
import { ROUTES } from "@imgc/constants/route";
import {
  saveBrandingAction,
  resetBrandingAction,
} from "@imgc/actions/branding";
import {
  savePersonalizationAction,
  resetPersonalizationAction,
} from "@imgc/actions/personalization";

export type AppearanceStudioMode = "admin" | "user";

export interface AppearanceStudioProps {
  mode: AppearanceStudioMode;
  initialBranding?: LenderBrandingData | null;
  initialPersonalization?: UserPersonalizationData;
  availableLenders?: { id: string; name: string }[];
  currentLenderOrgId?: string;
  userName?: string;
  userRole?: string;
}

type TabType = "theme" | "colors" | "display";

export function AppearanceStudioClient({
  mode,
  initialBranding,
  initialPersonalization,
  availableLenders = [],
  currentLenderOrgId,
  userName = "Naveen Kumar",
  userRole = "Operations Executive",
}: AppearanceStudioProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected lender for Admin mode
  const [selectedOrgId, setSelectedOrgId] = useState(
    currentLenderOrgId ?? (availableLenders[0]?.id || "org_abc")
  );

  // Active Tab for User Personalization mode (Theme, Colors, Display)
  const [activeTab, setActiveTab] = useState<TabType>("theme");

  // Determine initial state based on mode
  const initialTheme =
    mode === "admin"
      ? (initialBranding?.theme ?? DEFAULT_BRAND_THEME)
      : (initialPersonalization?.theme ?? DEFAULT_BRAND_THEME);

  const initialColors =
    mode === "admin"
      ? (initialBranding?.theme?.customColors ?? {})
      : (initialPersonalization?.customColors ?? {});

  // State
  const [colorMode, setColorMode] = useState<"light" | "dark" | "system">(
    initialTheme.colorMode ?? "light"
  );
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>(
    initialTheme.themeKey ?? "qualtech"
  );

  const [brandPrimary, setBrandPrimary] = useState(initialTheme.brandPrimary);
  const [brandDark, setBrandDark] = useState(initialTheme.brandDark);
  const [brandMuted, setBrandMuted] = useState(initialTheme.brandMuted);
  const [brandLight, setBrandLight] = useState(initialTheme.brandLight);

  const [customColors, setCustomColors] =
    useState<LenderCustomColors>(initialColors);
  const bgPattern = initialTheme.bgPattern ?? "clean";
  const language = initialPersonalization?.language ?? "en";
  const [density, setDensity] = useState<
    "compact" | "comfortable" | "executive" | "presentation"
  >(
    (initialTheme.density as
      "compact" | "comfortable" | "executive" | "presentation" | undefined) ??
      "comfortable"
  );
  const [highContrast, setHighContrast] = useState<boolean>(
    Boolean(
      initialTheme.highContrast ?? initialPersonalization?.highContrast ?? false
    )
  );
  const [largeClickTargets, setLargeClickTargets] = useState<boolean>(
    Boolean(
      initialTheme.largeClickTargets ??
      initialPersonalization?.largeClickTargets ??
      false
    )
  );
  const [isDensityOpen, setIsDensityOpen] = useState(false);

  // Logo & Title state (Admin only)
  const [portalTitle, setPortalTitle] = useState(
    initialBranding?.portalTitle ?? "IMGC Lender Portal"
  );
  const [logoUrl, setLogoUrl] = useState<string | undefined>(
    initialBranding?.logoUrl ??
      (selectedOrgId === "org_acme" ? "/assets/icons/hdfclogo.png" : undefined)
  );
  const [imgcLogoUrl, setImgcLogoUrl] = useState<string>(
    initialBranding?.imgcLogoUrl ?? "/assets/icons/imgc-mark.svg"
  );

  // Sync state if server initialBranding changes during render (adjusting state from props)
  const [prevBranding, setPrevBranding] = useState(initialBranding);
  if (initialBranding !== prevBranding) {
    setPrevBranding(initialBranding);
    if (initialBranding) {
      if (initialBranding.portalTitle)
        setPortalTitle(initialBranding.portalTitle);
      setLogoUrl(initialBranding.logoUrl);
      if (initialBranding.imgcLogoUrl)
        setImgcLogoUrl(initialBranding.imgcLogoUrl);
    }
  }

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Theme Preset Change Handler
  const handleSelectPreset = (preset: ThemePreset) => {
    setSelectedThemeKey(preset.id);
    setBrandPrimary(preset.theme.brandPrimary);
    setBrandDark(preset.theme.brandDark);
    setBrandMuted(preset.theme.brandMuted);
    setBrandLight(preset.theme.brandLight);
    // Clear custom color overrides to inherit from selected preset cleanly
    setCustomColors({});
  };

  // Custom Color Override Handler
  const handleColorChange = (key: keyof LenderCustomColors, value: string) => {
    setCustomColors((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (key === "primary") {
      setBrandPrimary(value);
    }
  };

  const handleClearColor = (key: keyof LenderCustomColors) => {
    setCustomColors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (key === "primary") {
      const preset = THEME_PRESETS.find((p) => p.id === selectedThemeKey);
      if (preset) {
        setBrandPrimary(preset.theme.brandPrimary);
      }
    }
  };

  // IMGC Logo file upload handler
  const handleImgcLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "IMGC Logo must be under 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImgcLogoUrl(base64);
      setStatusMessage({
        type: "success",
        text: "IMGC Brand Logo updated in preview.",
      });
    };
    reader.readAsDataURL(file);
  };

  // Logo file upload handler (Admin only)
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Logo must be under 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLogoUrl(base64);
      setStatusMessage({
        type: "success",
        text: "Lender Logo updated in preview.",
      });
    };
    reader.readAsDataURL(file);
  };

  // Save / Apply Changes
  const handleApplyChanges = () => {
    setStatusMessage(null);
    startTransition(async () => {
      if (mode === "admin") {
        // Institutional Identity ONLY: IMGC Master Mark + Lender Navbar Logo + Portal Title.
        // Themes are kept separate and not implemented from IMGC to lender.
        const res = await saveBrandingAction(selectedOrgId, {
          portalTitle,
          logoUrl,
          imgcLogoUrl,
        });

        if (res.ok) {
          setStatusMessage({
            type: "success",
            text: "Institutional logos and portal identity updated successfully.",
          });
          router.refresh();
        } else {
          setStatusMessage({
            type: "error",
            text: res.error || "Failed to save organization logos.",
          });
        }
      } else {
        // User Personalization Mode
        const res = await savePersonalizationAction({
          colorMode,
          themeKey: selectedThemeKey,
          theme: {
            brandPrimary,
            brandDark,
            brandMuted,
            brandLight,
            colorMode,
            themeKey: selectedThemeKey,
            highContrast,
            largeClickTargets,
          },
          customColors,
          bgPattern,
          language,
          density,
          highContrast,
          largeClickTargets,
        });

        if (res.ok) {
          setStatusMessage({
            type: "success",
            text: "Personal appearance preferences saved to your profile.",
          });
          router.refresh();
        } else {
          setStatusMessage({
            type: "error",
            text: res.error || "Failed to save personal preferences.",
          });
        }
      }
    });
  };

  // Reset to Defaults
  const handleReset = () => {
    setStatusMessage(null);
    startTransition(async () => {
      if (mode === "admin") {
        const res = await resetBrandingAction(selectedOrgId);
        if (res.ok) {
          handleSelectPreset(THEME_PRESETS[0]!);
          setPortalTitle("IMGC Lender Portal");
          setLogoUrl(undefined);
          setImgcLogoUrl("/assets/icons/imgc-mark.svg");
          setDensity("comfortable");
          setHighContrast(false);
          setLargeClickTargets(false);
          setStatusMessage({
            type: "success",
            text: "Organization branding reset to system defaults.",
          });
          router.refresh();
        }
      } else {
        const res = await resetPersonalizationAction();
        if (res.ok) {
          handleSelectPreset(THEME_PRESETS[0]!);
          setColorMode("light");
          setCustomColors({});
          setDensity("comfortable");
          setHighContrast(false);
          setLargeClickTargets(false);
          setStatusMessage({
            type: "success",
            text: "Reset to your organization's default appearance.",
          });
          router.refresh();
        }
      }
    });
  };

  // Effective colors for preview
  const effectivePrimary = customColors.primary || brandPrimary;
  const effectiveSidebarBg =
    customColors.sidebarBg || (colorMode === "dark" ? "#0f172a" : "#0d1b2a");
  const effectiveSidebarText =
    customColors.sidebarText || (colorMode === "dark" ? "#94a3b8" : "#94a3b8");
  const effectiveSidebarActive = customColors.sidebarActive || effectivePrimary;
  const effectiveChartAccent = customColors.chartAccent || effectivePrimary;

  const effectiveLenderLogo =
    mode === "admin"
      ? (logoUrl ??
        (selectedOrgId === "org_acme"
          ? "/assets/icons/hdfclogo.png"
          : undefined))
      : initialPersonalization?.institutionalLogoUrl || logoUrl;

  const orgName =
    mode === "admin"
      ? availableLenders.find((l) => l.id === selectedOrgId)?.name ||
        "IMGC Operations"
      : initialPersonalization?.institutionalName || "IMGC Lender Portal";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fafc] text-neutral-900">
      {/* ── Studio Unified Action Bar (Single, compact, high-precision) ── */}
      <div className="z-10 flex h-12 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-white px-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.claimDashboard}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs transition hover:bg-neutral-50 hover:text-neutral-900"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-outfit text-sm font-bold text-neutral-900">
              {mode === "admin"
                ? "Logos & Institutional Branding"
                : "Appearance Studio & Personalization"}
            </h1>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-600">
              {mode === "admin" ? "IMGC Administration" : "User Preferences"}
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sandbox
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-600">
            <ShieldCheckIcon className="size-3 text-neutral-500" />
            {mode === "admin" ? "Institutional Scope" : "User Profile Scope"}
          </span>

          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs transition hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
            title="Reset to defaults"
          >
            <RotateCcwIcon className="size-3" />
            <span>Reset</span>
          </button>

          <Link
            href={ROUTES.claimDashboard}
            className="rounded-lg border border-transparent px-2.5 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleApplyChanges}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-50"
          >
            <CheckIcon className="size-3.5" />
            <span>
              {isPending
                ? "Saving..."
                : mode === "admin"
                  ? "Save Logos & Identity"
                  : "Apply Personalization"}
            </span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`shrink-0 flex items-center justify-between border-b px-4 py-1.5 text-xs font-medium ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-sm leading-none text-neutral-500 hover:text-neutral-900"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Studio Canvas: Two Columns (Exact height, 0 page scroll) ──── */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-12 overflow-hidden">
        {/* ── Left Column: Controls & Settings ─────────────────────────── */}
        <div className="flex flex-col h-full min-h-0 lg:col-span-5 xl:col-span-5 overflow-hidden">
          <div className="flex flex-col h-full min-h-0 rounded-xl border border-neutral-200/90 bg-white p-3 shadow-xs overflow-hidden">
            {/* Header for Admin Mode (Logos & Identity) OR Sub-tabs Bar for User Mode (Personalization) */}
            {mode === "admin" ? (
              <>
                <div className="shrink-0 flex items-center justify-between pb-2 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="size-4 text-brand-primary" />
                    <h3 className="text-xs font-bold text-neutral-900">
                      Institutional Identity &amp; Logos
                    </h3>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-bold text-blue-700">
                    IMGC Administration
                  </span>
                </div>
                <div className="shrink-0 mt-2 flex items-center justify-between rounded-lg border border-amber-200/80 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-800">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheckIcon className="size-3.5 text-amber-600 shrink-0" />
                    <span>
                      <strong>Institutional Scope:</strong> IMGC configures
                      master &amp; lender logos. User themes are customized
                      individually and will not be overwritten.
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <div className="shrink-0 flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("theme")}
                  className={`flex-1 rounded-md py-1 text-center text-xs font-bold transition-all ${
                    activeTab === "theme"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Theme
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("colors")}
                  className={`flex-1 rounded-md py-1 text-center text-xs font-bold transition-all ${
                    activeTab === "colors"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Colors
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("display")}
                  className={`flex-1 rounded-md py-1 text-center text-xs font-bold transition-all ${
                    activeTab === "display"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Display
                </button>
              </div>
            )}

            {/* ── Content with internal smooth scroll ──────────── */}
            <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
              {mode === "admin" ? (
                <div className="space-y-3">
                  {/* Section 1: IMGC Master Brand Logo (Sidebar) */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div>
                        <span className="block text-xs font-bold text-neutral-800">
                          IMGC Master Logo
                        </span>
                        <p className="text-[10.5px] text-neutral-500">
                          Primary system brand mark rendered in the sidebar
                          rail.
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-[9.5px] font-bold text-brand-primary">
                        Sidebar Mark
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/60 p-2">
                      <div className="flex items-center gap-2.5">
                        <div className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-2xs">
                          <Image
                            src={imgcLogoUrl || "/assets/icons/imgc-mark.svg"}
                            alt="IMGC Logo"
                            fill
                            unoptimized
                            className="object-contain p-0.5"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-neutral-800 block">
                            IMGC Brand Mark
                          </span>
                          <span className="text-[9.5px] text-neutral-400">
                            Visible to all users in sidebar
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer rounded-md bg-white border border-neutral-300 px-2 py-1 text-[11px] font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImgcLogoFileChange}
                            className="hidden"
                          />
                        </label>
                        {imgcLogoUrl !== "/assets/icons/imgc-mark.svg" && (
                          <button
                            type="button"
                            onClick={() =>
                              setImgcLogoUrl("/assets/icons/imgc-mark.svg")
                            }
                            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Lender Institutional Logo (Navbar) */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs space-y-3">
                    {/* Scope Selection Box: Placed directly here so it is clear which lender logos are being changed */}
                    {availableLenders.length > 0 && (
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label
                            htmlFor="lender-scope-dropdown"
                            className="flex items-center gap-1.5 text-xs font-bold text-neutral-900"
                          >
                            <BuildingIcon className="size-3.5 text-brand-primary" />
                            <span>Target Lender Organization</span>
                          </label>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
                            Active Scope
                          </span>
                        </div>
                        <p className="text-[10.5px] text-neutral-500 mb-2">
                          Choose which lender&apos;s institutional logo and
                          portal identity you are configuring below.
                        </p>
                        <select
                          id="lender-scope-dropdown"
                          value={selectedOrgId}
                          onChange={(e) => {
                            setSelectedOrgId(e.target.value);
                            router.push(`?org=${e.target.value}`);
                          }}
                          className="h-8.5 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-bold text-neutral-900 shadow-2xs outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition"
                        >
                          {availableLenders.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div>
                        <span className="block text-xs font-bold text-neutral-800">
                          Lender Logo ({orgName})
                        </span>
                        <p className="text-[10.5px] text-neutral-500">
                          Rendered on the left side of the navbar before Claim
                          Dashboard (Lenders only).
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
                        Navbar Logo
                      </span>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div className="mt-2.5 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-2.5 text-center transition hover:border-brand-primary/50">
                      <UploadCloudIcon className="mx-auto size-5 text-neutral-400" />
                      <label className="mt-1 block cursor-pointer text-xs font-bold text-brand-primary hover:underline">
                        <span>Upload lender logo or drag &amp; drop</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="mt-0.5 text-[10px] text-neutral-400">
                        Supports PNG, SVG, JPG, WebP (max. 2MB)
                      </p>
                    </div>

                    {/* Current Lender Logo */}
                    {logoUrl ? (
                      <div className="mt-2 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/60 p-2">
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-7 w-20 shrink-0 overflow-hidden rounded border border-neutral-200 bg-white p-0.5 shadow-2xs">
                            <Image
                              src={logoUrl}
                              alt="Lender Logo"
                              fill
                              unoptimized
                              className="object-contain"
                            />
                          </div>
                          <span className="text-xs font-semibold text-neutral-800">
                            Active Navbar Logo
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLogoUrl(undefined)}
                          className="text-xs font-semibold text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-neutral-200 bg-neutral-50/40 p-2 text-neutral-500 text-[11px]">
                        <span>No custom logo set (shows fallback badge).</span>
                        <button
                          type="button"
                          onClick={() =>
                            setLogoUrl("/assets/icons/hdfclogo.png")
                          }
                          className="text-xs font-bold text-brand-primary hover:underline"
                        >
                          Use Sample Logo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Portal Display Title */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs">
                    <label
                      htmlFor="portal-display-title-input"
                      className="mb-1 block text-xs font-bold text-neutral-800"
                    >
                      Portal Display Title
                    </label>
                    <input
                      id="portal-display-title-input"
                      type="text"
                      value={portalTitle}
                      onChange={(e) => setPortalTitle(e.target.value)}
                      placeholder="e.g. HDFC Home Loans Portal"
                      className="h-8 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-xs outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    />
                    <p className="mt-1 text-[10.5px] text-neutral-400">
                      Shown in the sidebar header and top workspace breadcrumbs.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* TAB 1: THEME */}
                  {activeTab === "theme" && (
                    <div className="space-y-3">
                      {/* COLOR MODE */}
                      <div>
                        <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                          Color Mode
                        </span>
                        <div className="grid grid-cols-3 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                          {COLOR_MODE_OPTIONS.map((modeOpt) => {
                            const isSelected = colorMode === modeOpt.id;
                            return (
                              <button
                                key={modeOpt.id}
                                type="button"
                                onClick={() => setColorMode(modeOpt.id)}
                                className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition ${
                                  isSelected
                                    ? "bg-neutral-900 text-white shadow-xs font-bold"
                                    : "text-neutral-600 hover:bg-white hover:text-neutral-900"
                                }`}
                              >
                                {modeOpt.icon === "sun" && (
                                  <SunIcon className="size-3" />
                                )}
                                {modeOpt.icon === "moon" && (
                                  <MoonIcon className="size-3" />
                                )}
                                {modeOpt.icon === "laptop" && (
                                  <LaptopIcon className="size-3" />
                                )}
                                <span>{modeOpt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* THEMES LIST */}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                            Themes
                          </span>
                          <span className="text-[10.5px] text-neutral-400">
                            {THEME_PRESETS.length} presets
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {THEME_PRESETS.map((preset) => {
                            const isSelected = selectedThemeKey === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => handleSelectPreset(preset)}
                                className={`relative flex flex-col justify-between rounded-lg border p-2 text-left transition-all ${
                                  isSelected
                                    ? "border-brand-primary bg-brand-light/30 ring-2 ring-brand-primary/20"
                                    : "border-neutral-200/90 bg-white hover:border-neutral-300 hover:bg-neutral-50/50"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className="size-3 rounded-full shadow-2xs"
                                    style={{ backgroundColor: preset.dotColor }}
                                  />
                                  {isSelected && (
                                    <CheckIcon className="size-3 text-brand-primary font-bold" />
                                  )}
                                </div>
                                <span className="mt-1 text-[11px] font-bold text-neutral-900 leading-tight">
                                  {preset.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: COLORS */}
                  {activeTab === "colors" && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-neutral-500">
                        Override individual colors on top of the selected theme.
                        Clear a swatch to inherit from the theme again.
                      </p>

                      <div className="space-y-1.5">
                        {[
                          {
                            key: "primary",
                            label: "Primary / Buttons",
                            defaultVal: brandPrimary,
                          },
                          {
                            key: "sidebarBg",
                            label: "Sidebar Background",
                            defaultVal: "#0d1b2a",
                          },
                          {
                            key: "sidebarText",
                            label: "Sidebar Text",
                            defaultVal: "#94a3b8",
                          },
                          {
                            key: "sidebarActive",
                            label: "Sidebar Active",
                            defaultVal: brandPrimary,
                          },
                          {
                            key: "chartAccent",
                            label: "Chart Accent",
                            defaultVal: brandPrimary,
                          },
                        ].map(({ key, label, defaultVal }) => {
                          const colorKey = key as keyof LenderCustomColors;
                          const hasOverride = Boolean(customColors[colorKey]);
                          const currentVal =
                            customColors[colorKey] || defaultVal;

                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-2 transition hover:bg-white"
                            >
                              <span className="text-[11px] font-semibold text-neutral-800">
                                {label}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <label
                                  htmlFor={`color-input-${key}`}
                                  className="relative flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black/10 shadow-2xs"
                                >
                                  <span className="sr-only">{label}</span>
                                  <input
                                    id={`color-input-${key}`}
                                    type="color"
                                    value={currentVal}
                                    onChange={(e) =>
                                      handleColorChange(
                                        colorKey,
                                        e.target.value
                                      )
                                    }
                                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                                  />
                                  <span
                                    className="size-full rounded-full"
                                    style={{ backgroundColor: currentVal }}
                                  />
                                </label>

                                {hasOverride && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearColor(colorKey)}
                                    title="Reset to theme default"
                                    className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                  >
                                    <Trash2Icon className="size-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: DISPLAY */}
                  {activeTab === "display" && (
                    <div className="space-y-4">
                      {/* Density Dropdown */}
                      <div>
                        <span className="mb-1.5 block text-xs font-semibold text-neutral-800">
                          Density
                        </span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsDensityOpen((prev) => !prev)}
                            className="flex h-9 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 text-left text-xs text-neutral-800 shadow-2xs hover:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          >
                            <span className="truncate">
                              {DENSITY_OPTIONS.find((d) => d.id === density)
                                ?.label ?? "Comfortable — standard spacing"}
                            </span>
                            <ChevronDownIcon
                              className={`size-3.5 shrink-0 text-neutral-500 transition-transform duration-150 ${
                                isDensityOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {isDensityOpen && (
                            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                              {DENSITY_OPTIONS.map((d) => {
                                const isSelected = density === d.id;
                                return (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => {
                                      setDensity(d.id);
                                      setIsDensityOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition ${
                                      isSelected
                                        ? "bg-neutral-100/70 font-medium text-neutral-900"
                                        : "text-neutral-700 hover:bg-neutral-50"
                                    }`}
                                  >
                                    <span className="truncate">{d.label}</span>
                                    {isSelected && (
                                      <CheckIcon className="size-4 shrink-0 text-neutral-900" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* High Contrast */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="pr-4">
                          <p className="text-xs font-semibold text-neutral-900">
                            High Contrast
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Stronger borders and contrast for readability.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={highContrast}
                          onClick={() => setHighContrast((prev) => !prev)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            highContrast ? "bg-brand-primary" : "bg-neutral-300"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              highContrast ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Large Click Targets */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="pr-4">
                          <p className="text-xs font-semibold text-neutral-900">
                            Large Click Targets
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Bigger buttons and inputs for touch accessibility.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={largeClickTargets}
                          onClick={() => setLargeClickTargets((prev) => !prev)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            largeClickTargets
                              ? "bg-brand-primary"
                              : "bg-neutral-300"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              largeClickTargets
                                ? "translate-x-4"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: LIVE PREVIEW Sandbox ───────────────────────── */}
        <div className="flex flex-col h-full min-h-0 rounded-xl border border-neutral-200/90 bg-white p-3 shadow-xs lg:col-span-7 xl:col-span-7 overflow-hidden">
          {/* Preview Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-400">
                LIVE PREVIEW
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-700">
                Dashboard Canvas
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600"
                title="Confidential KPI metrics blurred for privacy in simulated preview"
              >
                <LockIcon className="size-2.5 text-neutral-500" />
                <span>KPIs Obfuscated</span>
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Instant Sandbox</span>
              </div>
            </div>
          </div>

          {/* ── Mockup Sandbox Container ─────────────────────────────────── */}
          <div className="mt-2 flex-1 min-h-0 overflow-hidden rounded-lg border border-neutral-200/80 bg-neutral-50 shadow-inner flex flex-col">
            <div
              className="flex h-full min-h-0 w-full overflow-hidden"
              style={{
                backgroundColor: colorMode === "dark" ? "#0b0f19" : "#f8fafc",
              }}
            >
              {/* 1. Mini Mockup Sidebar */}
              <div
                className="flex w-44 shrink-0 flex-col border-r border-white/10 p-2.5 transition-colors overflow-hidden"
                style={{ backgroundColor: effectiveSidebarBg }}
              >
                {/* Sidebar Brand Header */}
                <div className="flex items-center gap-2 pb-2.5 border-b border-white/10">
                  <div className="relative flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white font-bold text-[10px]">
                    <Image
                      src={imgcLogoUrl || "/assets/icons/imgc-mark.svg"}
                      alt="IMGC Logo"
                      fill
                      unoptimized
                      className="object-contain p-0.5"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-white leading-tight">
                      {portalTitle}
                    </p>
                    <p className="truncate text-[9.5px] text-white/50">
                      {orgName}
                    </p>
                  </div>
                </div>

                {/* Sidebar Nav Items */}
                <div className="mt-2.5 space-y-1">
                  <div
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-bold text-white shadow-xs"
                    style={{
                      background: `linear-gradient(90deg, ${effectiveSidebarActive} 0%, ${brandDark} 100%)`,
                    }}
                  >
                    <div className="size-1.5 rounded-full bg-white animate-pulse" />
                    <span>Dashboard</span>
                  </div>

                  <div
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-white/5"
                    style={{ color: effectiveSidebarText }}
                  >
                    <span className="size-1 rounded-full bg-current opacity-40" />
                    <span>Claims</span>
                  </div>

                  <div
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-white/5"
                    style={{ color: effectiveSidebarText }}
                  >
                    <span className="size-1 rounded-full bg-current opacity-40" />
                    <span>Documents</span>
                  </div>

                  <div
                    className="flex items-center justify-between rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-white/5"
                    style={{ color: effectiveSidebarText }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-1 rounded-full bg-current opacity-40" />
                      <span>Notifications</span>
                    </div>
                    <span className="rounded-full bg-destructive px-1.5 py-0.2 text-[8.5px] font-bold text-white">
                      6
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Mini Mockup Main Content */}
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                {/* Top Bar Greeting & Search */}
                <div className="flex h-8 shrink-0 items-center justify-between border-b border-neutral-200/60 bg-white/70 px-3 backdrop-blur-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Lender Logo Badge (Rendered on left side before page title, for lender) */}
                    {effectiveLenderLogo ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative flex h-5 max-w-[80px] items-center justify-center rounded border border-neutral-200/90 bg-white px-1.5 py-0.5 shadow-2xs">
                          <Image
                            src={effectiveLenderLogo}
                            alt="Lender Logo"
                            width={60}
                            height={16}
                            className="max-h-4 w-auto object-contain"
                            unoptimized
                          />
                        </div>
                        <span className="h-3.5 w-px bg-neutral-200" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex h-5 items-center justify-center rounded border border-neutral-200/90 bg-white px-1.5 text-[9px] font-bold text-neutral-700 shadow-2xs">
                          {orgName.substring(0, 4).toUpperCase()}
                        </div>
                        <span className="h-3.5 w-px bg-neutral-200" />
                      </div>
                    )}
                    <p className="text-[11px] font-bold text-neutral-800 truncate">
                      Claim Dashboard
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <SearchIcon className="absolute left-2 size-3 text-neutral-400" />
                      <input
                        type="text"
                        readOnly
                        placeholder="Search claims, policies..."
                        className="h-6 w-40 rounded-full border border-neutral-200 bg-white pl-6 pr-2 text-[10px] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <BotIcon className="size-3.5" />
                      <BellIcon className="size-3.5" />
                      <div
                        className="size-4.5 rounded-full text-white text-[8px] font-bold grid place-items-center"
                        style={{ backgroundColor: effectivePrimary }}
                        title={`${userName} (${userRole})`}
                      >
                        {userName.charAt(0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Dashboard Canvas */}
                <div className="flex-1 min-h-0 p-2.5 flex flex-col justify-between overflow-hidden gap-2">
                  {/* 5-Card KPI Strip */}
                  <div className="grid grid-cols-5 gap-2 shrink-0">
                    {[
                      {
                        title: "ACTIVE CLAIMS",
                        value: "142",
                        color: effectivePrimary,
                      },
                      {
                        title: "ACTION REQUIRED",
                        value: "12",
                        color: "#f59e0b",
                      },
                      { title: "DOCS PENDING", value: "28", color: "#ea580c" },
                      { title: "IN PROGRESS", value: "45", color: "#0ea5e9" },
                      { title: "SETTLED CFY", value: "89", color: "#8b5cf6" },
                    ].map((kpi, idx) => (
                      <div
                        key={idx}
                        className={`relative flex flex-col justify-between overflow-hidden rounded-lg bg-white p-2 transition-all ${
                          highContrast
                            ? "border-2 border-neutral-400 shadow-xs"
                            : "border border-neutral-200/80 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[8.5px] font-bold uppercase tracking-wider text-neutral-400">
                            {kpi.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          {/* KPI Number - Intentionally blurred for mockup privacy */}
                          <span
                            className="font-outfit text-sm font-bold text-neutral-900 select-none cursor-default"
                            style={{ filter: "blur(5px)", opacity: 0.7 }}
                            title="Confidential KPI blurred in simulated preview"
                          >
                            {kpi.value}
                          </span>
                          {/* Mini SVG Sparkline - Blurred */}
                          <div
                            style={{ filter: "blur(2.5px)", opacity: 0.7 }}
                            className="select-none"
                          >
                            <svg
                              className="h-3.5 w-10 stroke-2"
                              fill="none"
                              viewBox="0 0 50 16"
                            >
                              <path
                                d={
                                  idx % 2 === 0
                                    ? "M0 12 Q 15 2, 25 10 T 50 4"
                                    : "M0 14 Q 20 14, 30 6 T 50 2"
                                }
                                stroke={kpi.color}
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Lower 4 Feature Cards */}
                  <div className="grid grid-cols-4 gap-2 flex-1 min-h-0 overflow-hidden">
                    {/* Card 1: AI Insights */}
                    <div
                      className={`flex flex-col justify-between rounded-lg bg-white p-2.5 transition-all ${
                        highContrast
                          ? "border-2 border-neutral-400 shadow-xs"
                          : "border border-neutral-200/80 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                          AI Insights
                        </span>
                        <span className="rounded bg-emerald-50 px-1 py-0.2 text-[8px] font-bold text-emerald-700">
                          LIVE
                        </span>
                      </div>
                      <div className="my-auto flex items-center gap-2">
                        <div
                          className="size-6 shrink-0 rounded-full border-2 grid place-items-center text-[10px] font-bold"
                          style={{
                            borderColor: effectiveChartAccent,
                            color: effectiveChartAccent,
                          }}
                        >
                          !
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-neutral-800">
                            Anomaly Detection
                          </p>
                          <p
                            className="text-[9px] text-neutral-500 select-none cursor-default"
                            style={{ filter: "blur(3.5px)", opacity: 0.7 }}
                            title="Metric blurred for privacy"
                          >
                            2 cases flagged for DPD drift
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Claims by Stage */}
                    <div
                      className={`flex flex-col justify-between rounded-lg bg-white p-2.5 transition-all ${
                        highContrast
                          ? "border-2 border-neutral-400 shadow-xs"
                          : "border border-neutral-200/80 shadow-2xs"
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                        Claims by Stage
                      </span>
                      <div className="my-auto space-y-1 text-[9.5px]">
                        <div className="flex items-center justify-between text-neutral-600">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: effectivePrimary }}
                            />
                            Registered
                          </span>
                          <span
                            className="font-semibold text-neutral-900 select-none cursor-default"
                            style={{ filter: "blur(4px)", opacity: 0.7 }}
                          >
                            42
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-600">
                          <span className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Under Review
                          </span>
                          <span
                            className="font-semibold text-neutral-900 select-none cursor-default"
                            style={{ filter: "blur(4px)", opacity: 0.7 }}
                          >
                            18
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-600">
                          <span className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Approved
                          </span>
                          <span
                            className="font-semibold text-neutral-900 select-none cursor-default"
                            style={{ filter: "blur(4px)", opacity: 0.7 }}
                          >
                            89
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Policy Portfolio (Donut) */}
                    <div
                      className={`flex flex-col justify-between rounded-lg bg-white p-2.5 transition-all ${
                        highContrast
                          ? "border-2 border-neutral-400 shadow-xs"
                          : "border border-neutral-200/80 shadow-2xs"
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                        Portfolio Health
                      </span>
                      <div className="my-auto flex items-center justify-around">
                        <div className="relative grid size-10 place-items-center">
                          <svg className="size-10 -rotate-90">
                            <circle
                              cx="20"
                              cy="20"
                              r="15"
                              stroke="#f1f5f9"
                              strokeWidth="3"
                              fill="transparent"
                            />
                            <circle
                              cx="20"
                              cy="20"
                              r="15"
                              stroke={effectivePrimary}
                              strokeWidth="3"
                              strokeDasharray="94"
                              strokeDashoffset="21"
                              strokeLinecap="round"
                              fill="transparent"
                            />
                          </svg>
                          <span
                            className="absolute text-[10px] font-bold text-neutral-800 select-none cursor-default"
                            style={{ filter: "blur(4px)", opacity: 0.7 }}
                          >
                            78%
                          </span>
                        </div>
                        <div
                          className="space-y-0.5 text-[9px] text-neutral-500 select-none cursor-default"
                          style={{ filter: "blur(3px)", opacity: 0.7 }}
                        >
                          <p>Healthy: 78%</p>
                          <p>Watchlist: 15%</p>
                          <p>Default: 7%</p>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: SLA Performance */}
                    <div
                      className={`flex flex-col justify-between rounded-lg bg-white p-2.5 transition-all ${
                        highContrast
                          ? "border-2 border-neutral-400 shadow-xs"
                          : "border border-neutral-200/80 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                          SLA Performance
                        </span>
                        <span className="text-[8.5px] font-bold text-emerald-600">
                          On Track
                        </span>
                      </div>
                      <div className="my-auto">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 flex">
                          <div
                            className="h-full rounded-l-full"
                            style={{
                              width: "82%",
                              backgroundColor: effectivePrimary,
                            }}
                          />
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: "12%" }}
                          />
                          <div
                            className="h-full bg-destructive rounded-r-full"
                            style={{ width: "6%" }}
                          />
                        </div>
                        <div
                          className="mt-1.5 flex items-center justify-between text-[8.5px] text-neutral-400 select-none cursor-default"
                          style={{ filter: "blur(3px)", opacity: 0.7 }}
                        >
                          <span>Within SLA (82%)</span>
                          <span>Breach (6%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

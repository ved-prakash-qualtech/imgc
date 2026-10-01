"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import Image from "next/image";
import {
  PaletteIcon,
  RotateCcwIcon,
  SaveIcon,
  CheckCircle2Icon,
  SparklesIcon,
  Building2Icon,
  ExternalLinkIcon,
  InfoIcon,
  UploadCloudIcon,
  Trash2Icon,
  Link2Icon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { toast } from "sonner";
import {
  saveBrandingAction,
  resetBrandingAction,
} from "@/app/[locale]/(portal)/admin/branding/actions";
import type { LenderBrandingData } from "@/services/portal/brandingConfig.server";
import { DEFAULT_BRAND_THEME } from "@/constants/branding";
import type { LenderTheme } from "@/server/mock/types";

export type BrandingConfigClientProps = Readonly<{
  lenders: ReadonlyArray<{ id: string; name: string }>;
  selectedLenderId: string | null;
  initialBranding: LenderBrandingData | null;
}>;

interface ThemePreset {
  name: string;
  theme: LenderTheme;
  description: string;
}

const PRESET_THEMES: ThemePreset[] = [
  {
    name: "IMGC Classic Orange",
    theme: {
      brandPrimary: "#f26522",
      brandDark: "#c74a10",
      brandMuted: "#fdeade",
      brandLight: "#fff7f2",
    },
    description: "IMGC signature vibrant orange & warm neutral tints",
  },
  {
    name: "miFIN™ Tech Blue",
    theme: {
      brandPrimary: "#0466c8",
      brandDark: "#044b95",
      brandMuted: "#d4e4fb",
      brandLight: "#eef6ff",
    },
    description: "Default financial technology trust palette",
  },
  {
    name: "HDFC Royal Navy",
    theme: {
      brandPrimary: "#004c8f",
      brandDark: "#002d5b",
      brandMuted: "#cfe2f3",
      brandLight: "#f0f6fc",
    },
    description: "Deep enterprise banking blue with crisp accents",
  },
  {
    name: "ICICI Crimson & Amber",
    theme: {
      brandPrimary: "#b02a30",
      brandDark: "#7a171d",
      brandMuted: "#f8d7da",
      brandLight: "#fdf2f2",
    },
    description: "Corporate crimson with high visibility badges",
  },
  {
    name: "Emerald Green",
    theme: {
      brandPrimary: "#059669",
      brandDark: "#065f46",
      brandMuted: "#d1fae5",
      brandLight: "#ecfdf5",
    },
    description: "Growth & asset management fresh green",
  },
  {
    name: "Axis Burgundy",
    theme: {
      brandPrimary: "#97144d",
      brandDark: "#670c32",
      brandMuted: "#f6d6e2",
      brandLight: "#fcf1f5",
    },
    description: "Premium retail banking velvet burgundy",
  },
];

const PRESET_LOGOS = [
  { label: "IMGC Full Logo", url: "/assets/icons/logo.png" },
  { label: "IMGC Mark", url: "/assets/icons/imgc-mark.svg" },
  { label: "HDFC Bank", url: "/assets/icons/hdfclogo.png" },
  { label: "Qualtech Edge", url: "/assets/icons/Qualtech-blk.png" },
];

/**
 * Utility to calculate harmonic shades from a primary hex code.
 */
function generateHarmonicPalette(hex: string): LenderTheme {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return DEFAULT_BRAND_THEME;

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Darker shade: 25% darker
  const darkR = Math.max(0, Math.floor(r * 0.75)).toString(16).padStart(2, "0");
  const darkG = Math.max(0, Math.floor(g * 0.75)).toString(16).padStart(2, "0");
  const darkB = Math.max(0, Math.floor(b * 0.75)).toString(16).padStart(2, "0");

  // Muted shade: 80% white blend
  const mutedR = Math.min(255, Math.floor(r + (255 - r) * 0.8)).toString(16).padStart(2, "0");
  const mutedG = Math.min(255, Math.floor(g + (255 - g) * 0.8)).toString(16).padStart(2, "0");
  const mutedB = Math.min(255, Math.floor(b + (255 - b) * 0.8)).toString(16).padStart(2, "0");

  // Light tint: 93% white blend
  const lightR = Math.min(255, Math.floor(r + (255 - r) * 0.94)).toString(16).padStart(2, "0");
  const lightG = Math.min(255, Math.floor(g + (255 - g) * 0.94)).toString(16).padStart(2, "0");
  const lightB = Math.min(255, Math.floor(b + (255 - b) * 0.94)).toString(16).padStart(2, "0");

  return {
    brandPrimary: `#${cleanHex}`,
    brandDark: `#${darkR}${darkG}${darkB}`,
    brandMuted: `#${mutedR}${mutedG}${mutedB}`,
    brandLight: `#${lightR}${lightG}${lightB}`,
  };
}

export function BrandingConfigClient({
  lenders,
  selectedLenderId,
  initialBranding,
}: BrandingConfigClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentTheme = initialBranding?.theme ?? DEFAULT_BRAND_THEME;

  const [brandPrimary, setBrandPrimary] = useState(currentTheme.brandPrimary);
  const [brandDark, setBrandDark] = useState(currentTheme.brandDark);
  const [brandMuted, setBrandMuted] = useState(currentTheme.brandMuted);
  const [brandLight, setBrandLight] = useState(currentTheme.brandLight);

  const [portalTitle, setPortalTitle] = useState(
    initialBranding?.portalTitle ?? (initialBranding?.name ? `${initialBranding.name} Portal` : "")
  );
  const [logoUrl, setLogoUrl] = useState(initialBranding?.logoUrl ?? "");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [logoMode, setLogoMode] = useState<"upload" | "url">("upload");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);

  const processFile = (file: File) => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image file (PNG, JPG, SVG, or WebP)");
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image file is too large (max 2MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setLogoUrl(result);
        setUploadedFileName(file.name);
        setUploadedFileSize(`${(file.size / 1024).toFixed(1)} KB`);
        toast.success(`Logo "${file.name}" uploaded successfully!`);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read the selected file");
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0]) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0]) {
      processFile(files[0]);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    setUploadedFileName(null);
    setUploadedFileSize(null);
    toast.info("Logo cleared");
  };

  // Detect dirty state
  const isDirty = useMemo(() => {
    return (
      brandPrimary !== currentTheme.brandPrimary ||
      brandDark !== currentTheme.brandDark ||
      brandMuted !== currentTheme.brandMuted ||
      brandLight !== currentTheme.brandLight ||
      portalTitle !== (initialBranding?.portalTitle ?? `${initialBranding?.name ?? ""} Portal`) ||
      logoUrl !== (initialBranding?.logoUrl ?? "")
    );
  }, [brandPrimary, brandDark, brandMuted, brandLight, portalTitle, logoUrl, currentTheme, initialBranding]);

  const handleLenderChange = (id: string) => {
    const params = new URLSearchParams();
    params.set("lender", id);
    router.push(`${pathname}?${params.toString()}`);
  };

  const applyPreset = (preset: ThemePreset) => {
    setBrandPrimary(preset.theme.brandPrimary);
    setBrandDark(preset.theme.brandDark);
    setBrandMuted(preset.theme.brandMuted);
    setBrandLight(preset.theme.brandLight);
    toast.success(`Applied "${preset.name}" palette`);
  };

  const handleAutoHarmonize = () => {
    const generated = generateHarmonicPalette(brandPrimary);
    setBrandDark(generated.brandDark);
    setBrandMuted(generated.brandMuted);
    setBrandLight(generated.brandLight);
    toast.success("Harmonic palette generated from primary color");
  };

  const handleSave = () => {
    if (!selectedLenderId) return;

    startTransition(async () => {
      const res = await saveBrandingAction(selectedLenderId, {
        portalTitle: portalTitle.trim(),
        logoUrl: logoUrl.trim() || undefined,
        theme: {
          brandPrimary,
          brandDark,
          brandMuted,
          brandLight,
        },
      });

      if (res.ok) {
        toast.success("Branding configuration saved successfully!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to save branding configuration");
      }
    });
  };

  const handleReset = () => {
    if (!selectedLenderId) return;

    if (!confirm("Are you sure you want to reset this lender's branding to system defaults?")) {
      return;
    }

    startTransition(async () => {
      const res = await resetBrandingAction(selectedLenderId);
      if (res.ok) {
        setBrandPrimary(DEFAULT_BRAND_THEME.brandPrimary);
        setBrandDark(DEFAULT_BRAND_THEME.brandDark);
        setBrandMuted(DEFAULT_BRAND_THEME.brandMuted);
        setBrandLight(DEFAULT_BRAND_THEME.brandLight);
        setLogoUrl("");
        setUploadedFileName(null);
        setUploadedFileSize(null);
        setPortalTitle(initialBranding?.name ? `${initialBranding.name} Portal` : "");
        toast.success("Branding reset to defaults");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to reset branding");
      }
    });
  };

  if (!selectedLenderId || !initialBranding) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-600">
        <Building2Icon className="mx-auto size-12 text-neutral-400 mb-3" />
        <p className="text-base font-semibold">No lender organization selected.</p>
        <p className="text-xs text-neutral-500 mt-1">Please select an organization from the menu to configure its branding.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Bar: Lender Selector & Save Action ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-light text-brand-primary">
            <PaletteIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              Lender Branding Configuration
            </h1>
            <p className="text-xs text-neutral-500">
              Configure per-lender theme tokens, logo marks, and portal headings.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="lender-picker" className="text-xs font-semibold text-neutral-600">
              Organization:
            </label>
            <select
              id="lender-picker"
              value={selectedLenderId}
              onChange={(e) => handleLenderChange(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-2xs focus:border-brand-primary focus:outline-hidden"
            >
              {lenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            <RotateCcwIcon className="size-3.5" />
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Save Branding
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-900 border border-amber-200 animate-in fade-in">
          <span className="font-medium">
            You have unsaved changes. Click <strong>Save Branding</strong> to apply them.
          </span>
          <span className="text-[11px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded font-mono">
            Unsaved Draft
          </span>
        </div>
      )}

      {/* ── Main Grid: Editor Controls (Left) & Real-time Live Preview (Right) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Identity & Headings Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Building2Icon className="size-4 text-neutral-500" />
              Portal Identity & Logo
            </h2>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="portal-title-input"
                  className="block text-xs font-semibold text-neutral-700 mb-1"
                >
                  Portal Display Title
                </label>
                <input
                  id="portal-title-input"
                  type="text"
                  value={portalTitle}
                  onChange={(e) => setPortalTitle(e.target.value)}
                  placeholder="e.g. HDFC Bank Portal"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-900 focus:border-brand-primary focus:outline-hidden"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Shown in the sidebar header and top workspace breadcrumbs.
                </p>
              </div>

              {/* Logo Upload & URL Options */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700">
                    Logo Configuration
                  </span>
                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => setLogoMode("upload")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        logoMode === "upload"
                          ? "bg-white text-neutral-900 shadow-2xs"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      <UploadCloudIcon className="size-3 text-brand-primary" />
                      Upload / Drag & Drop
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoMode("url")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        logoMode === "url"
                          ? "bg-white text-neutral-900 shadow-2xs"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      <Link2Icon className="size-3" />
                      Asset URL
                    </button>
                  </div>
                </div>

                {/* If logo is set, display preview card with quick replace/remove */}
                {logoUrl && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50/80 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white border border-neutral-200 p-1 shadow-2xs overflow-hidden">
                        <Image
                          src={logoUrl}
                          alt="Configured Logo"
                          width={40}
                          height={40}
                          className="object-contain max-h-full max-w-full"
                          unoptimized={Boolean(logoUrl.startsWith("data:") || logoUrl.startsWith("http"))}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-neutral-900 truncate">
                          {uploadedFileName ||
                            (logoUrl.startsWith("data:")
                              ? "Custom Uploaded File"
                              : logoUrl.split("/").pop() || "Custom Logo")}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {uploadedFileSize ||
                            (logoUrl.startsWith("data:")
                              ? "Embedded Base64"
                              : "Local / Web Asset")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-2xs"
                      >
                        <UploadCloudIcon className="size-3 text-neutral-500" />
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        title="Remove Logo"
                      >
                        <Trash2Icon className="size-3" />
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="logo-file-picker"
                  aria-label="Upload logo file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Mode 1: Drag & Drop Zone */}
                {logoMode === "upload" && (
                  <div
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-brand-primary bg-brand-light/30 ring-2 ring-brand-primary"
                        : "border-neutral-300 bg-neutral-50/50 hover:border-brand-primary hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex size-10 items-center justify-center rounded-full bg-white shadow-2xs border border-neutral-200 text-neutral-600">
                      <UploadCloudIcon className="size-5 text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-800">
                        <span className="text-brand-primary underline underline-offset-2">Click to browse</span> or drag and drop logo here
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Supports PNG, SVG, JPG, or WebP (max. 2MB)
                      </p>
                    </div>
                  </div>
                )}

                {/* Mode 2: Manual URL input */}
                {logoMode === "url" && (
                  <div>
                    <label
                      htmlFor="logo-url-input"
                      className="block text-xs font-semibold text-neutral-700 mb-1"
                    >
                      Image URL or Relative Path
                    </label>
                    <input
                      id="logo-url-input"
                      type="text"
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setUploadedFileName(null);
                        setUploadedFileSize(null);
                      }}
                      placeholder="/assets/icons/logo.png or https://..."
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-900 focus:border-brand-primary focus:outline-hidden font-mono"
                    />
                  </div>
                )}

                {/* Logo Quick Presets */}
                <div>
                  <span className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Sample Logo Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_LOGOS.map((p) => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => {
                          setLogoUrl(p.url);
                          setUploadedFileName(p.label);
                          setUploadedFileSize("Built-in Preset");
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs border transition-colors ${
                          logoUrl === p.url
                            ? "border-brand-primary bg-brand-light text-brand-primary font-semibold"
                            : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-xs text-neutral-500 hover:text-neutral-800 underline px-1 py-1"
                      >
                        Clear Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Palettes Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <SparklesIcon className="size-4 text-amber-500" />
                Curated Brand Palettes
              </h2>
              <span className="text-[11px] text-neutral-400">1-Click Apply</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PRESET_THEMES.map((preset) => {
                const isActive =
                  brandPrimary.toLowerCase() === preset.theme.brandPrimary.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      isActive
                        ? "border-brand-primary bg-neutral-50 ring-1 ring-brand-primary shadow-xs"
                        : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50"
                    }`}
                  >
                    <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                      <div
                        className="size-5 rounded-md shadow-2xs border border-white"
                        style={{ backgroundColor: preset.theme.brandPrimary }}
                      />
                      <div
                        className="size-5 rounded-md shadow-2xs border border-white"
                        style={{ backgroundColor: preset.theme.brandMuted }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 truncate">
                          {preset.name}
                        </span>
                        {isActive && (
                          <CheckCircle2Icon className="size-3.5 text-brand-primary shrink-0 ml-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-tight mt-0.5 line-clamp-2">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand Tokens Color Editor */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <PaletteIcon className="size-4 text-neutral-500" />
                Custom miFIN™ Brand Tokens
              </h2>
              <button
                type="button"
                onClick={handleAutoHarmonize}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline"
              >
                <SparklesIcon className="size-3" />
                Auto-generate shades
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary */}
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="brand-primary-input" className="text-xs font-semibold text-neutral-800">
                    Primary Brand Color
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">
                    --color-brand-primary
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandPrimary}
                    aria-label="Primary Brand Color picker"
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="size-8 rounded border border-neutral-300 cursor-pointer bg-white p-0.5"
                  />
                  <input
                    id="brand-primary-input"
                    type="text"
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-mono text-neutral-800 focus:border-brand-primary focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Main buttons, active links, primary charts.
                </p>
              </div>

              {/* Dark */}
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="brand-dark-input" className="text-xs font-semibold text-neutral-800">
                    Dark Brand Accent
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">
                    --color-brand-dark
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandDark}
                    aria-label="Dark Brand Accent picker"
                    onChange={(e) => setBrandDark(e.target.value)}
                    className="size-8 rounded border border-neutral-300 cursor-pointer bg-white p-0.5"
                  />
                  <input
                    id="brand-dark-input"
                    type="text"
                    value={brandDark}
                    onChange={(e) => setBrandDark(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-mono text-neutral-800 focus:border-brand-primary focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Hover states, hero gradient ends, dark text.
                </p>
              </div>

              {/* Muted */}
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="brand-muted-input" className="text-xs font-semibold text-neutral-800">
                    Muted / Border Accent
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">
                    --color-brand-muted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandMuted}
                    aria-label="Muted Brand Accent picker"
                    onChange={(e) => setBrandMuted(e.target.value)}
                    className="size-8 rounded border border-neutral-300 cursor-pointer bg-white p-0.5"
                  />
                  <input
                    id="brand-muted-input"
                    type="text"
                    value={brandMuted}
                    onChange={(e) => setBrandMuted(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-mono text-neutral-800 focus:border-brand-primary focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Selected row backgrounds, pill badges, subtle borders.
                </p>
              </div>

              {/* Light */}
              <div className="rounded-lg border border-neutral-200 p-3 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="brand-light-input" className="text-xs font-semibold text-neutral-800">
                    Light Surface Tint
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">
                    --color-brand-light
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandLight}
                    aria-label="Light Surface Tint picker"
                    onChange={(e) => setBrandLight(e.target.value)}
                    className="size-8 rounded border border-neutral-300 cursor-pointer bg-white p-0.5"
                  />
                  <input
                    id="brand-light-input"
                    type="text"
                    value={brandLight}
                    onChange={(e) => setBrandLight(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-mono text-neutral-800 focus:border-brand-primary focus:outline-hidden"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1">
                  Card highlights, table row tint, icon containers.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-50/60 p-3 text-xs text-blue-900 border border-blue-100">
              <InfoIcon className="size-4 shrink-0 text-blue-500 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Multi-Tenant Rule 6:</strong> Neutrals, semantic alert colors (red/green/yellow),
                typography, and spacing remain locked to the QCP system. Only brand tokens & logos are
                overridden per tenant.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <ExternalLinkIcon className="size-4 text-neutral-500" />
                Live Preview
              </h2>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Interactive Mockup
              </span>
            </div>

            {/* Container applying inline preview CSS custom properties */}
            <div
              className="rounded-2xl border border-neutral-200 bg-neutral-100/70 p-4 shadow-sm space-y-4 overflow-hidden"
              style={{
                // @ts-expect-error CSS variable overrides for live preview
                "--color-brand-primary": brandPrimary,
                "--color-brand-dark": brandDark,
                "--color-brand-muted": brandMuted,
                "--color-brand-light": brandLight,
                "--grad-hero": `linear-gradient(135deg, ${brandPrimary} 0%, ${brandDark} 100%)`,
              }}
            >
              {/* Preview 1: Sidebar Snippet */}
              <div className="rounded-xl bg-gradient-to-b from-[#5c5c5c] to-[#383838] p-4 text-white shadow-md">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                  Sidebar Header
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm overflow-hidden p-1">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt="Preview Logo"
                        width={32}
                        height={32}
                        className="object-contain max-h-full max-w-full"
                        unoptimized
                        onError={(e) => {
                          // Fallback if bad URL
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Image
                        src="/assets/icons/logo.png"
                        alt="Fallback Logo"
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-bold tracking-[0.08em] uppercase truncate"
                      style={{ color: brandPrimary }}
                    >
                      {portalTitle || `${initialBranding.name} Portal`}
                    </p>
                    <p className="text-[10px] text-neutral-300">
                      {initialBranding.name}
                    </p>
                  </div>
                </div>

                {/* Mock Active Nav Item */}
                <div className="mt-4 pt-3 border-t border-neutral-600/60">
                  <div
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-xs"
                    style={{ backgroundColor: brandPrimary }}
                  >
                    <PaletteIcon className="size-4" />
                    <span>Active Nav Item</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white mt-1">
                    <Building2Icon className="size-4" />
                    <span>Inactive Menu Item</span>
                  </div>
                </div>
              </div>

              {/* Preview 2: Dashboard Banner & Buttons */}
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs space-y-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  Buttons & Surface Components
                </span>

                {/* Hero Gradient Strip */}
                <div
                  className="rounded-lg p-3.5 text-white shadow-xs"
                  style={{
                    background: `linear-gradient(135deg, ${brandPrimary} 0%, ${brandDark} 100%)`,
                  }}
                >
                  <p className="text-xs font-bold">Total Approved Claims</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xl font-extrabold tracking-tight">₹ 28.53 Cr</span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.25)",
                        color: "#ffffff",
                      }}
                    >
                      +14.2% MoM
                    </span>
                  </div>
                </div>

                {/* Buttons Showcase */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
                    style={{ backgroundColor: brandPrimary }}
                  >
                    Primary Action
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      borderColor: brandPrimary,
                      color: brandPrimary,
                      backgroundColor: brandLight,
                    }}
                  >
                    Secondary Action
                  </button>

                  <span
                    className="rounded-md px-2.5 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: brandMuted,
                      color: brandDark,
                    }}
                  >
                    Muted Status
                  </span>
                </div>
              </div>

              {/* Palette Hex Summary Card */}
              <div className="rounded-xl border border-neutral-200 bg-white p-3.5 text-xs text-neutral-600 font-mono space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span>brandPrimary</span>
                  <span className="font-semibold text-neutral-900">{brandPrimary}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>brandDark</span>
                  <span className="font-semibold text-neutral-900">{brandDark}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>brandMuted</span>
                  <span className="font-semibold text-neutral-900">{brandMuted}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>brandLight</span>
                  <span className="font-semibold text-neutral-900">{brandLight}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

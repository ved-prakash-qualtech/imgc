"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/lib/error";
import { cn } from "@/lib/utils/twMergeUtils";

type WidgetErrorBoundaryProps = Readonly<{
  children: ReactNode;
  /** Full-page app fallback or inline widget fallback (default). */
  variant?: "app" | "widget";
  /** Short label shown in the widget fallback, e.g. "Credit score". */
  label?: string;
  /** Resets the boundary when any value changes (e.g. a refreshed query key). */
  resetKeys?: readonly unknown[];
  className?: string;
}>;

function AppFallback({ reset }: Readonly<{ reset: () => void }>) {
  const t = useTranslations("errors.app");

  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Button type="button" onClick={reset}>
        <RefreshCw className="size-4" />
        {t("retry")}
      </Button>
    </main>
  );
}

function WidgetFallback({
  label,
  reset,
  className,
}: Readonly<{ label?: string; reset: () => void; className?: string }>) {
  const t = useTranslations("errors.widget");

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-4",
        className
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="size-4" aria-hidden />
        {label ? t("failedWithLabel", { label }) : t("failed")}
      </p>
      <button
        type="button"
        onClick={reset}
        className="self-start text-xs text-destructive underline underline-offset-2"
      >
        {t("retry")}
      </button>
    </div>
  );
}

export function WidgetErrorBoundary({
  children,
  variant = "widget",
  label,
  resetKeys,
  className,
}: WidgetErrorBoundaryProps) {
  const renderFallback = useCallback(
    (_error: Error, reset: () => void) =>
      variant === "app" ? (
        <AppFallback reset={reset} />
      ) : (
        <WidgetFallback label={label} reset={reset} className={className} />
      ),
    [variant, label, className]
  );

  return (
    <ErrorBoundary resetKeys={resetKeys} fallback={renderFallback}>
      {children}
    </ErrorBoundary>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error/handle";
import { env } from "@/lib/utils/env";
import { cn } from "@/lib/utils/twMergeUtils";

export type ErrorBoundaryFallbackProps = Readonly<{
  error: Error;
  reset: () => void;
  className?: string;
}>;

export function ErrorBoundaryFallback({
  error,
  reset,
  className,
}: ErrorBoundaryFallbackProps) {
  const message = getErrorMessage(error) || "An unexpected error occurred";

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-danger-600/25 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="flex gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-600/10 text-danger-600"
          aria-hidden
        >
          <AlertTriangle className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-neutral-950">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-500">{message}</p>
          </div>
          {env.isDevelopment && error.stack ? (
            <pre className="max-h-40 overflow-auto rounded-md border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-500">
              {error.stack}
            </pre>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

import * as Sentry from "@sentry/nextjs";

import { readNextRuntime } from "@imgc/constants/env";

/** Re-exported by each app's `instrumentation.ts`, so every zone reports errors the same way. */
export async function register() {
  const nextRuntime = readNextRuntime();

  if (nextRuntime === "nodejs") {
    await import("@imgc/lib/sentry/server.config");
  }

  if (nextRuntime === "edge") {
    await import("@imgc/lib/sentry/edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

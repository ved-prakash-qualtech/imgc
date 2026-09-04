import * as Sentry from "@sentry/nextjs";

import { readNextRuntime } from "@/lib/utils/env";

export async function register() {
  const nextRuntime = readNextRuntime();

  if (nextRuntime === "nodejs") {
    await import("@/sentry.server.config");
  }

  if (nextRuntime === "edge") {
    await import("@/sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

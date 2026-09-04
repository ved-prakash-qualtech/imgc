import * as Sentry from "@sentry/nextjs";

import { isSentryEnabled } from "@/lib/sentry/env";
import type { LogData, LogEntry } from "@/types/logging";

function toSentryAttributes(
  data?: LogData
): Record<string, string | number | boolean> {
  if (!data) return {};

  const attributes: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      // eslint-disable-next-line security/detect-object-injection -- keys originate from caller log data
      attributes[key] = value;
      continue;
    }

    if (value !== undefined && value !== null) {
      try {
        // eslint-disable-next-line security/detect-object-injection -- keys originate from caller log data
        attributes[key] = JSON.stringify(value);
      } catch {
        // eslint-disable-next-line security/detect-object-injection -- keys originate from caller log data
        attributes[key] = String(value);
      }
    }
  }

  return attributes;
}

function sendToSentryLogger(entry: LogEntry): void {
  const attributes = {
    ...toSentryAttributes(entry.data),
    ...(entry.metadata.context && { context: entry.metadata.context }),
    level: entry.metadata.level,
  };

  switch (entry.metadata.level) {
    case "debug":
      Sentry.logger.debug(entry.message, attributes);
      break;
    case "info":
      Sentry.logger.info(entry.message, attributes);
      break;
    case "warn":
      Sentry.logger.warn(entry.message, attributes);
      break;
    case "error":
      Sentry.logger.error(entry.message, attributes);
      break;
    case "fatal":
      Sentry.logger.fatal(entry.message, attributes);
      break;
  }
}

export function sendLogEntryToSentry(entry: LogEntry): void {
  if (!isSentryEnabled()) return;

  sendToSentryLogger(entry);
}

export function captureExceptionToSentry(
  error: Error,
  context?: string,
  extra?: LogData,
  tenant?: string | null
): void {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setTag("context", context);
    }

    if (tenant) {
      scope.setTag("tenant", tenant);
    }

    if (extra) {
      scope.setContext("log", extra);
    }

    Sentry.captureException(error);
  });
}

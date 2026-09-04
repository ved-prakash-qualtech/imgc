import { getErrorMessage } from "@/lib/error/handle";
import {
  captureExceptionToSentry,
  sendLogEntryToSentry,
} from "@/lib/logging/sentrySink";
import { isSentryEnabled } from "@/lib/sentry/env";
import { env } from "@/lib/utils/env/env";
import type { LogLevel } from "@/types/env";
import type {
  LogEntry,
  LogOptions,
  Logger,
  LoggerConfig,
} from "@/types/logging";

export type {
  LogData,
  LogEntry,
  LogOptions,
  Logger,
  LoggerConfig,
} from "@/types/logging";

function getLevelPriority(level: LogLevel): number {
  switch (level) {
    case "debug":
      return 0;
    case "info":
      return 1;
    case "warn":
      return 2;
    case "error":
      return 3;
    case "fatal":
      return 4;
  }
}

const UNKNOWN_TIMESTAMP = "unknown";

let config: LoggerConfig | undefined;

function createDefaultConfig(): LoggerConfig {
  return {
    minLevel: env.isProduction ? "info" : "debug",
    enableConsole: !env.isProduction,
    enableRemote: env.isProduction,
    enableSentry: isSentryEnabled(),
  };
}

function getConfig(): LoggerConfig {
  config ??= createDefaultConfig();
  return config;
}

export function configureLogger(partial: Partial<LoggerConfig>): void {
  config = { ...getConfig(), ...partial };
}

function getTimestamp(): string {
  try {
    if (typeof Date !== "undefined") {
      return new Date().toISOString();
    }
  } catch {
    // Date may be unavailable or invalid in some runtimes
  }
  return UNKNOWN_TIMESTAMP;
}

function canLogToConsole(level: LogEntry["metadata"]["level"]): boolean {
  if (typeof console === "undefined") return false;

  switch (level) {
    case "debug":
      return typeof console.debug === "function";
    case "info":
      return typeof console.info === "function";
    case "warn":
      return typeof console.warn === "function";
    case "error":
    case "fatal":
      return typeof console.error === "function";
  }
}

function shouldLog(level: LogLevel): boolean {
  return getLevelPriority(level) >= getLevelPriority(getConfig().minLevel);
}

function resolveContext(
  baseContext: string | undefined,
  options?: LogOptions
): string | undefined {
  if (baseContext && options?.context)
    return `${baseContext}:${options.context}`;
  return baseContext ?? options?.context;
}

function createEntry(
  level: LogLevel,
  message: string,
  context: string | undefined,
  data?: LogOptions["data"]
): LogEntry {
  return {
    message,
    metadata: {
      timestamp: getTimestamp(),
      level,
      ...(context && { context }),
    },
    ...(data !== undefined && { data }),
  };
}

function logToConsole(entry: LogEntry): void {
  const { message, metadata, data } = entry;
  const prefix = metadata.context ? `[${metadata.context}]` : "";
  const line = `${metadata.timestamp} ${metadata.level.toUpperCase()}${prefix ? ` ${prefix}` : ""} ${message}`;

  if (!canLogToConsole(metadata.level)) return;

  switch (metadata.level) {
    case "debug":
      console.debug(line, data);
      break;
    case "info":
      console.info(line, data);
      break;
    case "warn":
      console.warn(line, data);
      break;
    case "error":
    case "fatal":
      console.error(line, data);
      break;
  }
}

function serializeLogEntry(entry: LogEntry): string {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({
      message: entry.message,
      metadata: entry.metadata,
    });
  }
}

async function logToRemote(entry: LogEntry): Promise<void> {
  const { remoteUrl } = getConfig();
  if (!remoteUrl || typeof fetch === "undefined") return;

  try {
    await fetch(remoteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serializeLogEntry(entry),
    });
  } catch (remoteError) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("Failed to send log to remote service", remoteError);
    }
  }
}

function emit(
  level: LogLevel,
  message: string,
  baseContext?: string,
  options?: LogOptions
): void {
  if (!shouldLog(level)) return;

  const entry = createEntry(
    level,
    message,
    resolveContext(baseContext, options),
    options?.data
  );

  const activeConfig = getConfig();

  if (activeConfig.enableConsole) {
    logToConsole(entry);
  }

  if (activeConfig.enableRemote) {
    void logToRemote(entry);
  }

  if (activeConfig.enableSentry) {
    sendLogEntryToSentry(entry);
  }
}

function createLogger(baseContext?: string): Logger {
  const log =
    (level: LogLevel) =>
    (message: string, options?: LogOptions): void =>
      emit(level, message, baseContext, options);

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    fatal: log("fatal"),
    child: (context) => createLogger(resolveContext(baseContext, { context })),
  };
}

export const logger = createLogger();

export function logError(
  error: unknown,
  errorInfo?: { componentStack?: string | null },
  context = "ErrorBoundary"
): void {
  const normalized =
    error instanceof Error ? error : new Error(getErrorMessage(error));

  const data = {
    error: {
      name: normalized.name,
      message: normalized.message,
      stack: normalized.stack,
      ...(errorInfo?.componentStack && {
        componentStack: errorInfo.componentStack,
      }),
    },
  };

  logger.error(normalized.message, { context, data });
  captureExceptionToSentry(normalized, context, data);
}

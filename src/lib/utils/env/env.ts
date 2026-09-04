import { z } from "zod";

import {
  DEFAULT_SOURCE_MAPS_ENABLED,
  ENV_RAW_FALLBACK_STRINGS,
  NEXT_RUNTIME_ENV_KEY,
  SOURCE_MAPS_ENV_KEY,
} from "../../../constants/envDefaults";
import {
  NEXT_PUBLIC_SENTRY_DSN_ENV_KEY,
  SENTRY_AUTH_TOKEN_ENV_KEY,
  SENTRY_DEBUG_ENV_KEY,
  SENTRY_DSN_ENV_KEY,
  SENTRY_ORG_ENV_KEY,
  SENTRY_PROJECT_ENV_KEY,
} from "../../../constants/sentry";
import {
  envRawSchema,
  envSchema,
  formatEnvZodError,
  type EnvRaw,
} from "../../resolver/envSchema";
import type { Env, NextRuntime } from "../../../types/env";

/**
 * Snapshot one `process.env` entry: trim whitespace and strip wrapping quotes.
 * Private to this module — all runtime access must go through `env` below.
 */
function readRawEnv(key: string, defaultValue = ""): string {
  // eslint-disable-next-line security/detect-object-injection -- keys are internal constants only
  const raw = process.env[key];
  if (raw === undefined || raw === null) {
    return defaultValue;
  }

  let value = String(raw).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || defaultValue;
}

function sourceMapsRawFallback(): string {
  return readRawEnv("NODE_ENV", "development") === "production"
    ? DEFAULT_SOURCE_MAPS_ENABLED
    : "true";
}

/** Collect raw string values from `process.env` before Zod validation. */
export function buildEnvRawFromProcessEnv(): EnvRaw {
  return {
    nodeEnv: readRawEnv("NODE_ENV", "development"),
    appEnv: readRawEnv("NEXT_PUBLIC_APP_ENV", "local"),
    apiBaseUrl: readRawEnv(
      "NEXT_PUBLIC_API_BASE_URL",
      ENV_RAW_FALLBACK_STRINGS.apiBaseUrl
    ),
    apiTimeoutMs: readRawEnv(
      "NEXT_PUBLIC_API_TIMEOUT_MS",
      ENV_RAW_FALLBACK_STRINGS.apiTimeoutMs
    ),
    jwtAuthEnabled: readRawEnv(
      "NEXT_PUBLIC_JWT_AUTH_ENABLED",
      ENV_RAW_FALLBACK_STRINGS.jwtAuthEnabled
    ),
    sourceMapsEnabled: readRawEnv(SOURCE_MAPS_ENV_KEY, sourceMapsRawFallback()),
    appVersion: readRawEnv(
      "NEXT_PUBLIC_APP_VERSION",
      ENV_RAW_FALLBACK_STRINGS.appVersion
    ),
    appName: readRawEnv(
      "NEXT_PUBLIC_APP_NAME",
      ENV_RAW_FALLBACK_STRINGS.appName
    ),
    analyze: readRawEnv("ANALYZE", "false"),
    ci: readRawEnv("CI", "false"),
    publicSentryDsn: readRawEnv(NEXT_PUBLIC_SENTRY_DSN_ENV_KEY),
    sentryDsn: readRawEnv(SENTRY_DSN_ENV_KEY),
    sentryOrg: readRawEnv(SENTRY_ORG_ENV_KEY),
    sentryProject: readRawEnv(SENTRY_PROJECT_ENV_KEY),
    sentryAuthToken: readRawEnv(SENTRY_AUTH_TOKEN_ENV_KEY),
    sentryTracesSampleRate: readRawEnv("SENTRY_TRACES_SAMPLE_RATE"),
    sentryDebug: readRawEnv(SENTRY_DEBUG_ENV_KEY, "false"),
  };
}

const nextRuntimeSchema = z.enum(["nodejs", "edge"]);

/**
 * Next.js sets `NEXT_RUNTIME` only when instrumentation / server bundles load.
 * Read at call time — not on the `env` singleton (parsed earlier at config load).
 */
export function readNextRuntime(): NextRuntime | undefined {
  const raw = readRawEnv(NEXT_RUNTIME_ENV_KEY);
  const result = nextRuntimeSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/** Validate and coerce raw env strings into the typed `Env` object. */
export function parseEnvFromRaw(raw: EnvRaw): Env {
  const rawResult = envRawSchema.safeParse(raw);
  if (!rawResult.success) {
    throw new Error(formatEnvZodError(rawResult.error));
  }

  const result = envSchema.safeParse(rawResult.data);
  if (!result.success) {
    throw new Error(formatEnvZodError(result.error));
  }

  return result.data;
}

function parseEnv(): Env {
  return parseEnvFromRaw(buildEnvRawFromProcessEnv());
}

/**
 * Zod-validated environment singleton. Import this instead of reading
 * `process.env` anywhere in app code or `next.config.ts`.
 * Vault / backend secrets remain in `getServerEnv()` (`src/lib/serverEnv.ts`).
 */
export const env = parseEnv();

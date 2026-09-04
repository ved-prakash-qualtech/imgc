import type { EnvFallbackValues, EnvRawFallbackStrings } from "../types/env";

/** Build-time env key for browser/server/Turbopack source map generation. */
export const SOURCE_MAPS_ENV_KEY = "NEXT_SOURCE_MAPS_ENABLED";

/** Next.js runtime identifier (`nodejs` | `edge`) in instrumentation contexts. */
export const NEXT_RUNTIME_ENV_KEY = "NEXT_RUNTIME";

/** Fallback when unset in production (`next build` / `next start`). */
export const DEFAULT_SOURCE_MAPS_ENABLED = "false";

/** Fallback values when env vars are unset (used by env parsing only). */
const ENV_FALLBACK_VALUES = {
  apiBaseUrl: "http://localhost:3000/api",
  apiTimeoutMs: 30_000,
  appVersion: "0.0.1",
  appName: "QCP App",
  jwtAuthEnabled: "false",
  sourceMapsEnabled: DEFAULT_SOURCE_MAPS_ENABLED,
} as const satisfies EnvFallbackValues;

export const DEFAULT_API_BASE_URL = ENV_FALLBACK_VALUES.apiBaseUrl;
export const DEFAULT_API_TIMEOUT_MS = ENV_FALLBACK_VALUES.apiTimeoutMs;
export const DEFAULT_APP_VERSION = ENV_FALLBACK_VALUES.appVersion;
export const DEFAULT_APP_NAME = ENV_FALLBACK_VALUES.appName;
export const DEFAULT_JWT_AUTH_ENABLED = ENV_FALLBACK_VALUES.jwtAuthEnabled;

/** Raw `process.env` string defaults (typed for `EnvRaw` fields). */
export const ENV_RAW_FALLBACK_STRINGS = {
  apiBaseUrl: ENV_FALLBACK_VALUES.apiBaseUrl,
  apiTimeoutMs: `${ENV_FALLBACK_VALUES.apiTimeoutMs}`,
  jwtAuthEnabled: ENV_FALLBACK_VALUES.jwtAuthEnabled,
  sourceMapsEnabled: ENV_FALLBACK_VALUES.sourceMapsEnabled,
  appVersion: ENV_FALLBACK_VALUES.appVersion,
  appName: ENV_FALLBACK_VALUES.appName,
} as const satisfies EnvRawFallbackStrings;

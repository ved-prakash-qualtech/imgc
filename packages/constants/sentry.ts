/** Public DSN for browser / client instrumentation. */
export const NEXT_PUBLIC_SENTRY_DSN_ENV_KEY = "NEXT_PUBLIC_SENTRY_DSN";

/** Server / edge DSN (falls back to public DSN when unset). */
export const SENTRY_DSN_ENV_KEY = "SENTRY_DSN";

export const SENTRY_ORG_ENV_KEY = "SENTRY_ORG";
export const SENTRY_PROJECT_ENV_KEY = "SENTRY_PROJECT";
export const SENTRY_AUTH_TOKEN_ENV_KEY = "SENTRY_AUTH_TOKEN";
export const SENTRY_DEBUG_ENV_KEY = "SENTRY_DEBUG";

/** Production trace sampling when `SENTRY_TRACES_SAMPLE_RATE` is unset. */
export const DEFAULT_SENTRY_TRACES_SAMPLE_RATE_PRODUCTION = 0.1;

/** Development trace sampling when `SENTRY_TRACES_SAMPLE_RATE` is unset. */
export const DEFAULT_SENTRY_TRACES_SAMPLE_RATE_DEVELOPMENT = 1;

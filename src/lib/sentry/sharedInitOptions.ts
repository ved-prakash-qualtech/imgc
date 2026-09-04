import {
  DEFAULT_SENTRY_TRACES_SAMPLE_RATE_DEVELOPMENT,
  DEFAULT_SENTRY_TRACES_SAMPLE_RATE_PRODUCTION,
  SENTRY_DEBUG_ENV_KEY,
} from "@/constants/sentry";
import { readEnvValue } from "@/lib/utils/env/readEnvValue";

type SentryInitOptions = {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  enableLogs: boolean;
  debug: boolean;
};

function resolveTracesSampleRate(): number {
  const override = readEnvValue("SENTRY_TRACES_SAMPLE_RATE");
  if (override) {
    const parsed = Number(override);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }

  return process.env.NODE_ENV === "development"
    ? DEFAULT_SENTRY_TRACES_SAMPLE_RATE_DEVELOPMENT
    : DEFAULT_SENTRY_TRACES_SAMPLE_RATE_PRODUCTION;
}

export function buildSentryInitOptions(dsn: string): SentryInitOptions {
  const release = readEnvValue("NEXT_PUBLIC_APP_VERSION");
  const environment = readEnvValue(
    "NEXT_PUBLIC_APP_ENV",
    process.env.NODE_ENV ?? "development"
  );

  return {
    dsn,
    environment,
    ...(release && { release }),
    tracesSampleRate: resolveTracesSampleRate(),
    enableLogs: true,
    debug: readEnvValue(SENTRY_DEBUG_ENV_KEY) === "true",
  };
}

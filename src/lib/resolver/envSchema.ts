import { z } from "zod";

import {
  DEFAULT_SENTRY_TRACES_SAMPLE_RATE_DEVELOPMENT,
  DEFAULT_SENTRY_TRACES_SAMPLE_RATE_PRODUCTION,
} from "../../constants/sentry";
import type { Env } from "../../types/env";

const booleanEnvStringSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(["true", "false", "1", "0"]))
  .transform((value) => value === "true" || value === "1");

function resolveSentryTracesSampleRate(
  raw: string,
  nodeEnv: Env["nodeEnv"]
): number {
  const trimmed = raw.trim();
  if (trimmed) {
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
    throw new Error(
      `Invalid SENTRY_TRACES_SAMPLE_RATE: "${raw}" (expected a number between 0 and 1)`
    );
  }

  return nodeEnv === "development"
    ? DEFAULT_SENTRY_TRACES_SAMPLE_RATE_DEVELOPMENT
    : DEFAULT_SENTRY_TRACES_SAMPLE_RATE_PRODUCTION;
}

export const envRawSchema = z.object({
  nodeEnv: z.string(),
  appEnv: z.string(),
  apiBaseUrl: z.string(),
  apiTimeoutMs: z.string(),
  jwtAuthEnabled: z.string(),
  sourceMapsEnabled: z.string(),
  appVersion: z.string(),
  appName: z.string(),
  analyze: z.string(),
  ci: z.string(),
  publicSentryDsn: z.string(),
  sentryDsn: z.string(),
  sentryOrg: z.string(),
  sentryProject: z.string(),
  sentryAuthToken: z.string(),
  sentryTracesSampleRate: z.string(),
  sentryDebug: z.string(),
});

export type EnvRaw = z.infer<typeof envRawSchema>;

export const envSchema = z
  .object({
    nodeEnv: z.enum(["development", "production", "test"]),
    // QCP's environments are local / dev / uat / prod — the names in the hostnames
    // ({tenant}-{product}-dev), in the Spring profiles the services run, and on the QShip deploy
    // target. "dev" was missing here, so deploying a service built from this template failed its
    // build with "expected one of local|uat|prod|development" — the one name the platform uses
    // everywhere. "development" is kept because something may still pass it, but nodeEnv above is
    // where Node's vocabulary belongs.
    appEnv: z.enum(["local", "dev", "uat", "prod", "development"]),
    apiBaseUrl: z.url(),
    apiTimeoutMs: z.coerce.number().int().positive(),
    jwtAuthEnabled: booleanEnvStringSchema,
    sourceMapsEnabled: booleanEnvStringSchema,
    appVersion: z.string().min(1),
    appName: z.string().min(1),
    analyze: booleanEnvStringSchema,
    ci: booleanEnvStringSchema,
    publicSentryDsn: z.string(),
    sentryDsn: z.string(),
    sentryOrg: z.string(),
    sentryProject: z.string(),
    sentryAuthToken: z.string(),
    sentryTracesSampleRate: z.string(),
    sentryDebug: booleanEnvStringSchema,
  })
  .transform((data): Env => {
    const resolvedSentryDsn = data.sentryDsn || data.publicSentryDsn;

    return {
      nodeEnv: data.nodeEnv,
      appEnv: data.appEnv,
      apiBaseUrl: data.apiBaseUrl,
      apiTimeoutMs: data.apiTimeoutMs,
      jwtAuthEnabled: data.jwtAuthEnabled,
      sourceMapsEnabled: data.sourceMapsEnabled,
      appVersion: data.appVersion,
      appName: data.appName,
      analyzeEnabled: data.analyze,
      isCi: data.ci,
      publicSentryDsn: data.publicSentryDsn,
      sentryDsn: resolvedSentryDsn,
      sentryOrg: data.sentryOrg,
      sentryProject: data.sentryProject,
      sentryAuthToken: data.sentryAuthToken,
      sentryTracesSampleRate: resolveSentryTracesSampleRate(
        data.sentryTracesSampleRate,
        data.nodeEnv
      ),
      sentryDebug: data.sentryDebug,
      isSentryEnabled: Boolean(data.publicSentryDsn || data.sentryDsn),
      isProduction: data.nodeEnv === "production",
      isDevelopment: data.nodeEnv === "development",
      isTest: data.nodeEnv === "test",
    };
  });

export function formatEnvZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

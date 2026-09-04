/** http(s) URL used for API base env fallbacks and validation alignment */
export type HttpUrlString = `http://${string}` | `https://${string}`;

/** String boolean env values before coercion in env parsing */
export type BooleanEnvString = "true" | "false" | "1" | "0";

/** Fallback constants for env parsing (`src/constants/envDefaults.ts`) */
export type EnvFallbackValues = {
  apiBaseUrl: HttpUrlString;
  apiTimeoutMs: number;
  appVersion: string;
  appName: string;
  jwtAuthEnabled: BooleanEnvString;
  sourceMapsEnabled: BooleanEnvString;
};

/** String form of env fallbacks aligned with raw env fields */
export type EnvRawFallbackStrings = {
  apiBaseUrl: HttpUrlString;
  apiTimeoutMs: `${number}`;
  jwtAuthEnabled: BooleanEnvString;
  sourceMapsEnabled: BooleanEnvString;
  appVersion: string;
  appName: string;
};

export type NodeEnv = "development" | "production" | "test";

/** QCP's environments, as they are spelled in hostnames, profiles and deploy targets. */
export type AppEnv = "local" | "dev" | "uat" | "prod" | "development";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type NextRuntime = "nodejs" | "edge";

export type Env = {
  nodeEnv: NodeEnv;
  appEnv: AppEnv;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  apiBaseUrl: string;
  apiTimeoutMs: number;
  jwtAuthEnabled: boolean;
  sourceMapsEnabled: boolean;
  appVersion: string;
  appName: string;
  analyzeEnabled: boolean;
  isCi: boolean;
  publicSentryDsn: string;
  sentryDsn: string;
  sentryOrg: string;
  sentryProject: string;
  sentryAuthToken: string;
  sentryTracesSampleRate: number;
  sentryDebug: boolean;
  isSentryEnabled: boolean;
};

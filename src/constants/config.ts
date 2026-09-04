import { env } from "@/lib/utils/env";

export const APP_NAME = env.appName;

/** App-level runtime config (from env singleton). */
export const appConfig = {
  name: env.appName,
  version: env.appVersion,
  appEnv: env.appEnv,
  isProduction: env.isProduction,
  isDevelopment: env.isDevelopment,
} as const;

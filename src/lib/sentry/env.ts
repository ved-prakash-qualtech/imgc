import {
  NEXT_PUBLIC_SENTRY_DSN_ENV_KEY,
  SENTRY_DSN_ENV_KEY,
} from "@/constants/sentry";
import { readEnvValue } from "@/lib/utils/env/readEnvValue";

export function getPublicSentryDsn(): string {
  return readEnvValue(NEXT_PUBLIC_SENTRY_DSN_ENV_KEY);
}

export function getServerSentryDsn(): string {
  return readEnvValue(SENTRY_DSN_ENV_KEY, getPublicSentryDsn());
}

export function isSentryEnabled(): boolean {
  return Boolean(getPublicSentryDsn() || getServerSentryDsn());
}

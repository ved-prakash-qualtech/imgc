import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions } from "@/lib/sentry/sharedInitOptions";
import { getPublicSentryDsn } from "@/lib/sentry/env";

const dsn = getPublicSentryDsn();

if (dsn) {
  Sentry.init(buildSentryInitOptions(dsn));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

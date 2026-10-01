import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions } from "@imgc/lib/sentry/sharedInitOptions";
import { getPublicSentryDsn } from "@imgc/lib/sentry/env";

const dsn = getPublicSentryDsn();

if (dsn) {
  Sentry.init(buildSentryInitOptions(dsn));
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

import * as Sentry from "@sentry/nextjs";

import { getServerSentryDsn } from "@/lib/sentry/env";
import { buildSentryInitOptions } from "@/lib/sentry/sharedInitOptions";

const dsn = getServerSentryDsn();

if (dsn) {
  Sentry.init({
    ...buildSentryInitOptions(dsn),
    includeLocalVariables: true,
  });
}

import * as Sentry from "@sentry/nextjs";

import { getServerSentryDsn } from "@imgc/lib/sentry/env";
import { buildSentryInitOptions } from "@imgc/lib/sentry/sharedInitOptions";

const dsn = getServerSentryDsn();

if (dsn) {
  Sentry.init({
    ...buildSentryInitOptions(dsn),
    includeLocalVariables: true,
  });
}

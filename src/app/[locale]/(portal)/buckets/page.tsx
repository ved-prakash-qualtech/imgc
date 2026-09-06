import { BucketsClient } from "@/app/[locale]/(portal)/buckets/BucketsClient";

import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";

export const dynamic = "force-dynamic";

/** IMGC only — `PortalShell` refuses the page for a lender, whose nav has no `buckets` key. */
export default async function BucketsPage() {
  const session = await requireSession();
  const accounts = await listAccounts(session);

  return (
    <PortalShell activeKey="buckets" title="Processing Buckets">
      <div className="space-y-4">
        <BucketsClient accounts={accounts} />
      </div>
    </PortalShell>
  );
}

import { notFound } from "next/navigation";

import { AccountWorkspace } from "@/app/[locale]/(portal)/accounts/[accountId]/AccountWorkspace";
import { GridBackLink } from "@/components/portal/GridBackLink";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { ACCOUNTS_FILTER_KEY } from "@/lib/hooks/useRememberedFilters";
import { RETENTION_DAYS } from "@/server/mock/retention";
import { getAccount } from "@/services/portal/accounts.server";
import { listAuditForAccount } from "@/services/portal/audit.server";
import {
  getClaimForAccount,
  listQueries,
} from "@/services/portal/claimFlow.server";
import { listRemarks } from "@/services/portal/remarks.server";
import { canSubmit, listDocuments } from "@/services/portal/claims.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const session = await requireSession();

  // A lender asking for another lender's account gets a 404, not a 403: the account is not part
  // of their workspace at all, and confirming it exists would leak the pool.
  const account = await getAccount(session, accountId);
  if (!account) notFound();

  const [docs, events, claim] = await Promise.all([
    listDocuments(session, accountId),
    listAuditForAccount(accountId),
    getClaimForAccount(session, accountId),
  ]);

  const [queries, claimDocuments, remarks] = await Promise.all([
    claim ? listQueries(claim.id) : Promise.resolve([]),
    claim ? listClaimDocuments(session, claim.id) : Promise.resolve([]),
    listRemarks(accountId),
  ]);

  // Which rejected documents already have an open query naming them — so a fresh rejection
  // (already synced automatically) doesn't get a redundant "Raise Query" button, and only a
  // document rejected before that sync existed does.
  const queriedDocNames = new Set<string>();
  for (const q of queries) {
    if (q.respondedAt) continue;
    for (const name of q.requestedDocuments) queriedDocNames.add(name);
  }

  return (
    <PortalShell activeKey="accounts" title={account.loanNo}>
      <div className="space-y-3">
        <AccountWorkspace
          backLink={
            <GridBackLink
              href={ROUTES.accounts}
              storageKey={ACCOUNTS_FILTER_KEY}
              label="All accounts"
              className="-mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
            />
          }
          account={account}
          claim={claim}
          queries={queries}
          remarks={remarks.filter((remark) => remark.claimId === claim?.id)}
          claimDocuments={claimDocuments}
          role={session.role}
          docs={docs}
          events={events}
          canSubmit={canSubmit(docs)}
          retentionDays={RETENTION_DAYS}
          queriedDocNames={[...queriedDocNames]}
        />
      </div>
    </PortalShell>
  );
}

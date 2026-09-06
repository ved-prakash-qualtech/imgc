import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { AccountWorkspace } from "@/app/[locale]/(portal)/accounts/[accountId]/AccountWorkspace";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { RETENTION_DAYS } from "@/server/mock/retention";
import { getAccount } from "@/services/portal/accounts.server";
import { listAuditForAccount } from "@/services/portal/audit.server";
import { canSubmit, listDocuments } from "@/services/portal/claims.server";
import { getClaimForAccount, listQueries } from "@/services/portal/claimFlow.server";
import { pullFromPas } from "@/services/portal/pas.server";

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

  const [docs, pasValues, events] = await Promise.all([
    listDocuments(session, accountId),
    pullFromPas(session, accountId),
    listAuditForAccount(accountId),
  ]);

  // Which rejected documents already have an open query naming them — so a fresh rejection
  // (already synced automatically) doesn't get a redundant "Raise Query" button, and only a
  // document rejected before that sync existed does.
  const claim = await getClaimForAccount(session, accountId);
  const queriedDocNames = new Set<string>();
  if (claim) {
    const queries = await listQueries(claim.id);
    for (const q of queries) {
      if (q.respondedAt) continue;
      for (const name of q.requestedDocuments) queriedDocNames.add(name);
    }
  }

  return (
    <PortalShell activeKey="accounts" title={account.loanNo}>
      <div className="space-y-3">
        <Link
          href={ROUTES.accounts}
          className="-mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> All accounts
        </Link>

        <AccountWorkspace
          account={account}
          role={session.role}
          docs={docs}
          pasValues={pasValues}
          events={events}
          canSubmit={canSubmit(docs)}
          retentionDays={RETENTION_DAYS}
          queriedDocNames={[...queriedDocNames]}
        />
      </div>
    </PortalShell>
  );
}

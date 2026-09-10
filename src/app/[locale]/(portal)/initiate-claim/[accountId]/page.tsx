import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { ClaimWorkspace } from "@/components/portal/ClaimWorkspace";
import { Panel } from "@/components/portal/Panel";
import { PortalShell } from "@/components/portal/PortalShell";
import { claimConfig } from "@/config/claimConfig";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { getAccount } from "@/services/portal/accounts.server";
import {
  createClaim,
  getClaimForAccount,
} from "@/services/portal/claimFlow.server";
import { listClaimDocuments } from "@/services/portal/requirements.server";

export const dynamic = "force-dynamic";

export default async function ClaimWorkspacePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const session = await requireSession();

  // A lender asking for another lender's account gets a 404 — confirming it exists would leak
  // the pool. `getAccount` already applies that rule.
  const account = await getAccount(session, accountId);
  if (!account) notFound();

  let claim = await getClaimForAccount(session, accountId);

  // "Initiate Claim" lands straight on the form: if the lender has no claim on an eligible
  // account, start an Initial claim now. `createClaim` returns the existing one when there is
  // already a claim, so this is safe to run on every render. The type can still be switched at
  // the top of the form while the claim is a draft.
  if (
    !claim &&
    session.role === "LENDER" &&
    (account.npa || account.writeOff)
  ) {
    const created = await createClaim(session, accountId, "INITIAL");
    if (created.ok) claim = await getClaimForAccount(session, accountId);
  }

  const documents = claim ? await listClaimDocuments(session, claim.id) : [];
  const config = claim ? claimConfig(claim.claimType) : null;

  return (
    <PortalShell activeKey="initiate-claim" title={`Claim · ${account.loanNo}`}>
      <div className="space-y-6">
        <Link
          href={ROUTES.initiateClaim}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> Eligible cases
        </Link>

        {!claim || !config ? (
          <Panel title="No claim raised">
            <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
              {session.role === "LENDER"
                ? "This account is not eligible for a claim yet."
                : "The lender has not raised a claim on this account."}
            </p>
          </Panel>
        ) : (
          <ClaimWorkspace
              account={account}
              accountId={account.id}
              claimId={claim.id}
              claimNo={claim.claimNo}
              claimType={claim.claimType}
              status={claim.status}
              fields={claim.fields}
              documents={documents}
              openQuery={claim.openQuery}
              backHref={ROUTES.initiateClaim}
            />
        )}
      </div>
    </PortalShell>
  );
}

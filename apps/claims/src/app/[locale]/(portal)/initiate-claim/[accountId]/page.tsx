import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ClaimWorkspace } from "@imgc/features/portal/ClaimWorkspace";
import { Panel } from "@imgc/features/portal/Panel";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { claimConfig } from "@imgc/config/claimConfig";
import { ROUTES } from "@imgc/constants/route";
import { requireSession } from "@imgc/lib/auth/appSession";
import { getAdminContextOrNull } from "@imgc/lib/auth/adminContext";
import { withDbTransaction } from "@imgc/data/server/mock/db";
import { getAccount } from "@imgc/data/services/portal/accounts.server";
import {
  createClaim,
  getClaimForAccount,
  syncDraftChecklist,
} from "@imgc/data/services/portal/claimFlow.server";
import { discardUnsavedUploads } from "@imgc/data/services/portal/claims.server";
import { listClaimDocuments } from "@imgc/data/services/portal/requirements.server";

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

  const adminCtx = await getAdminContextOrNull();
  const isAdminActingForLender =
    session.role === "IMGC" &&
    !!adminCtx &&
    adminCtx.lenderOrgId === account.lenderOrgId;
  const canActAsLender = session.role === "LENDER" || isAdminActingForLender;

  let claim = await getClaimForAccount(session, accountId);

  // "Initiate Claim" lands straight on the form: if the lender has no claim on an eligible
  // account, start an Initial claim now. `createClaim` returns the existing one when there is
  // already a claim, so this is safe to run on every render. The type can still be switched at
  // the top of the form while the claim is a draft.
  if (!claim && canActAsLender && (account.npa || account.writeOff)) {
    // One transaction, so opening the workspace saves the new draft (and its audit entry) in a
    // single write rather than as a chain of them.
    const created = await withDbTransaction(() =>
      createClaim(session, accountId, "INITIAL")
    );
    if (created.ok) claim = await getClaimForAccount(session, accountId);
  }

  // A draft follows IMGC's Document Configuration as it stands now — documents IMGC added or
  // re-flagged since the claim was opened show up here (a no-op when nothing changed).
  if (claim) await syncDraftChecklist(claim.id);
  // Unsaved uploads survive only a refresh made by the open workspace itself (it marks itself
  // with this cookie while mounted). A fresh open drops them before anything renders, so a file
  // the lender left without Save Draft never flashes back on screen.
  if (claim?.status === "DRAFT") {
    const open = (await cookies()).get("imgc-draft-open")?.value;
    if (open !== claim.id)
      await discardUnsavedUploads(session, accountId, claim.id);
  }
  const documents = claim ? await listClaimDocuments(session, claim.id) : [];
  const config = claim ? claimConfig(claim.claimType) : null;

  const t = await getTranslations("claim");
  return (
    <PortalShell activeKey="initiate-claim" title="">
      <div>
        {!claim || !config ? (
          <Panel title={t("noClaimRaised")}>
            <p className="px-5 py-8 text-center text-ui-subhead text-neutral-500">
              {canActAsLender
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

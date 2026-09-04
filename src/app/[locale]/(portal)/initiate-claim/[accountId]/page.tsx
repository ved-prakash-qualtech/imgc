import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon, RadarIcon } from "lucide-react";

import { ClaimTypeSelectorClient } from "@/app/[locale]/(portal)/initiate-claim/[accountId]/ClaimTypeSelectorClient";
import { ClaimTimeline } from "@/components/portal/ClaimTimeline";
import { ClaimWorkspace } from "@/components/portal/ClaimWorkspace";
import { CommandBand } from "@/components/portal/CommandBand";
import type { BandStatProps } from "@/components/portal/CommandBand";
import { Panel } from "@/components/portal/Panel";
import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { claimConfig } from "@/config/claimConfig";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { getAccount } from "@/services/portal/accounts.server";
import { getClaimForAccount } from "@/services/portal/claimFlow.server";
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

  const claim = await getClaimForAccount(session, accountId);
  const documents = claim ? await listClaimDocuments(session, claim.id) : [];
  const config = claim ? claimConfig(claim.claimType) : null;

  const stats: BandStatProps[] = [
    {
      label: "NPA",
      value: account.npa ? "Yes" : "No",
      caption: "eligibility flag",
      accent: account.npa ? "amber" : undefined,
    },
    {
      label: "Write-off",
      value: account.writeOff ? "Yes" : "No",
      caption: "eligibility flag",
      accent: account.writeOff ? "amber" : undefined,
    },
    {
      icon: <FileTextIcon className="size-4" />,
      label: "Claim",
      value: claim ? claim.claimNo : "Not started",
      caption: claim ? claim.typeLabel : "no claim raised yet",
    },
    {
      icon: <RadarIcon className="size-4" />,
      label: "Documents",
      value: claim ? `${claim.approvedDocs}/${claim.requiredDocs}` : "—",
      caption: claim ? "mandatory approved" : "raise a claim to begin",
      accent: "teal",
    },
  ];

  return (
    <PortalShell activeKey="initiate-claim" title={`Claim · ${account.loanNo}`}>
      <div className="space-y-6">
        <Link
          href={ROUTES.initiateClaim}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> Eligible cases
        </Link>

        <CommandBand
          title={`${account.loanNo} · ${account.borrowerName}`}
          subtitle={`${account.lenderOrgName} · ${account.product} · ${account.branch}, ${account.region}`}
          stats={stats}
          action={
            claim ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={ROUTES.claimDetails(claim.id)} />}
              >
                <RadarIcon /> Track claim
              </Button>
            ) : undefined
          }
        />

        {!claim || !config ? (
          // Nothing raised yet — pick a type, which creates the claim and its checklist.
          <ClaimTypeSelectorClient
            accountId={account.id}
            canInitiate={session.role === "LENDER"}
          />
        ) : (
          <>
            <Panel title="Progress">
              <div className="px-5 py-4">
                <ClaimTimeline
                  claimType={claim.claimType}
                  status={claim.status}
                  history={claim.statusHistory}
                />
              </div>
            </Panel>

            <ClaimWorkspace
              accountId={account.id}
              claimId={claim.id}
              claimNo={claim.claimNo}
              status={claim.status}
              config={config}
              initialFields={claim.fields}
              documents={documents}
              openQuery={claim.openQuery}
              backHref={ROUTES.initiateClaim}
            />
          </>
        )}
      </div>
    </PortalShell>
  );
}

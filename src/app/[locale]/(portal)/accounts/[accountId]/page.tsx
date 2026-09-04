import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  BuildingIcon,
  FileClockIcon,
  InboxIcon,
  UploadCloudIcon,
} from "lucide-react";

import { AccountWorkspace } from "@/app/[locale]/(portal)/accounts/[accountId]/AccountWorkspace";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import { RETENTION_DAYS } from "@/server/mock/retention";
import { getAccount } from "@/services/portal/accounts.server";
import { listAuditForAccount } from "@/services/portal/audit.server";
import {
  canSubmit,
  listDocuments,
  summariseDocs,
} from "@/services/portal/claims.server";
import { pullFromPas } from "@/services/portal/pas.server";
import { listRemarks } from "@/services/portal/remarks.server";

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

  const [docs, pasValues, remarks, events] = await Promise.all([
    listDocuments(session, accountId),
    pullFromPas(session, accountId),
    listRemarks(accountId),
    listAuditForAccount(accountId),
  ]);

  // Rules 7 & 8 — derived from the rows, never stored.
  const summary = summariseDocs(docs);
  const readiness = summary.requiredCount
    ? Math.round((summary.approved / summary.requiredCount) * 100)
    : 0;

  return (
    <PortalShell activeKey="accounts" title={account.loanNo}>
      <div className="space-y-6">
        <Link
          href={ROUTES.accounts}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeftIcon className="size-3.5" /> All accounts
        </Link>

        <CommandBand
          title={`${account.loanNo} · ${account.borrowerName}`}
          subtitle={`${account.lenderOrgName} · ${account.product} · ${account.stage}`}
          stats={[
            {
              icon: <UploadCloudIcon className="size-4" />,
              label: "Documents approved",
              value: `${readiness}%`,
              caption: `${summary.approved} of ${summary.requiredCount} mandatory approved`,
              accent: summary.complete ? "teal" : "amber",
            },
            {
              icon: <FileClockIcon className="size-4" />,
              label: "Claim status",
              value: account.claimStatus,
              caption: account.submittedAt
                ? `submitted ${new Date(account.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                : "not yet submitted",
            },
            {
              icon: <InboxIcon className="size-4" />,
              label: "Processing bucket",
              value: account.bucket,
              caption:
                account.bucket === "IMGC"
                  ? "IMGC is processing this account"
                  : "with the lender for documents",
              accent: account.bucket === "LENDER" ? "amber" : undefined,
            },
            {
              icon: <BuildingIcon className="size-4" />,
              label: "Document completion",
              value: summary.complete ? "Complete" : "Incomplete",
              caption: summary.complete
                ? "every mandatory document approved"
                : `${summary.underReview} in review · ${summary.pending} pending · ${summary.reuploadRequired + summary.rejected} to re-upload`,
              accent: summary.complete ? "teal" : "rose",
            },
          ]}
        />

        <AccountWorkspace
          account={account}
          role={session.role}
          docs={docs}
          pasValues={pasValues}
          remarks={remarks}
          events={events}
          canSubmit={canSubmit(docs)}
          retentionDays={RETENTION_DAYS}
        />
      </div>
    </PortalShell>
  );
}

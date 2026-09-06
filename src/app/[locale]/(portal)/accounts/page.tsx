/* eslint-disable react-perf/jsx-no-new-array-as-prop */
import {
  AlertTriangleIcon,
  FileClockIcon,
  FolderOpenIcon,
  UploadCloudIcon,
} from "lucide-react";

import { AccountsClient } from "@/app/[locale]/(portal)/accounts/AccountsClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";
import { buildDashboardSummary } from "@/services/portal/dashboard.server";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await requireSession();
  const [accounts, summary] = await Promise.all([
    listAccounts(session),
    buildDashboardSummary(session),
  ]);

  const isLender = session.role === "LENDER";

  return (
    <PortalShell activeKey="accounts" title="Accounts">
      <div className="space-y-4">
        {isLender && (
          <CommandBand
            title="Accounts"
            subtitle="Accounts your organisation can act on — scope follows the domain of your sign-in address"
            stats={[
              {
                icon: <FolderOpenIcon className="size-4" />,
                label: "Accounts in scope",
                value: String(summary.accountCount),
                caption: `${summary.readyToSubmit} ready to submit`,
              },
              {
                icon: <UploadCloudIcon className="size-4" />,
                label: "Document readiness",
                value: `${summary.completionPct}%`,
                caption: `${summary.documentsIn} of ${summary.documentsRequired} mandatory in`,
                accent: "teal",
              },
              {
                icon: <FileClockIcon className="size-4" />,
                label: "Submitted / approved",
                value: `${summary.submittedCount} / ${summary.approvedCount}`,
                caption: `${summary.queriedCount} queried`,
              },
              {
                icon: <AlertTriangleIcon className="size-4" />,
                label: "Awaiting documents",
                value: String(summary.pendingUploadAccounts),
                caption: `${summary.rejectedDocCount} document(s) rejected`,
                accent: "amber",
              },
            ]}
          />
        )}

        <AccountsClient accounts={accounts} role={session.role} />
      </div>
    </PortalShell>
  );
}

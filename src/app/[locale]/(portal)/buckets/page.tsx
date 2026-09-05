import {
  ArrowLeftRightIcon,
  FileClockIcon,
  InboxIcon,
  MessageSquareWarningIcon,
} from "lucide-react";

import { BucketsClient } from "@/app/[locale]/(portal)/buckets/BucketsClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listAccounts } from "@/services/portal/accounts.server";

export const dynamic = "force-dynamic";

/** IMGC only — `PortalShell` refuses the page for a lender, whose nav has no `buckets` key. */
export default async function BucketsPage() {
  const session = await requireSession();
  const accounts = await listAccounts(session);

  const inImgc = accounts.filter((a) => a.bucket === "IMGC").length;
  const withLender = accounts.length - inImgc;
  const submitted = accounts.filter((a) => a.claimStatus === "SUBMITTED").length;
  const queried = accounts.filter((a) => a.claimStatus === "QUERIED").length;
  const pinned = accounts.filter((a) => a.pushRecipients.length > 0).length;

  return (
    <PortalShell activeKey="buckets" title="Processing Buckets">
      <div className="space-y-4">
        <CommandBand
          title="Processing buckets"
          subtitle="Pull an account into IMGC for processing, or hand it back to the lender for documents — every move notifies the stakeholders"
          stats={[
            {
              icon: <InboxIcon className="size-4" />,
              label: "In the IMGC bucket",
              value: String(inImgc),
              caption: "being processed by IMGC",
            },
            {
              icon: <ArrowLeftRightIcon className="size-4" />,
              label: "With the lender",
              value: String(withLender),
              caption: "collecting documents",
              accent: "amber",
            },
            {
              icon: <FileClockIcon className="size-4" />,
              label: "Submitted",
              value: String(submitted),
              caption: "ready for IMGC review",
              accent: "teal",
            },
            {
              icon: <MessageSquareWarningIcon className="size-4" />,
              label: "Queried",
              value: String(queried),
              caption: `${pinned} account(s) with pinned recipients`,
              accent: queried > 0 ? "rose" : undefined,
            },
          ]}
        />

        <BucketsClient accounts={accounts} />
      </div>
    </PortalShell>
  );
}

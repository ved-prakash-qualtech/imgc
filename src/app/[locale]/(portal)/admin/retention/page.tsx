import {
  ArchiveIcon,
  ClockIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { RetentionClient } from "@/app/[locale]/(portal)/admin/retention/RetentionClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import {
  RETENTION_DAYS,
  listRejectedDocuments,
  sweepExpiredRejections,
} from "@/services/portal/retention.server";

export const dynamic = "force-dynamic";

/** IMGC only. */
export default async function RetentionPage() {
  const session = await requireSession();
  await sweepExpiredRejections();
  const rows = await listRejectedDocuments(session);

  const held = rows.filter((r) => r.held).length;
  const pendingDecision = rows.filter(
    (r) => r.rejection.reinstate?.status === "REQUESTED"
  ).length;
  const expiringSoon = rows.filter((r) => !r.held && r.daysLeft <= 14).length;

  return (
    <PortalShell activeKey="admin-retention" title="Document Retention">
      <div className="space-y-6">
        <CommandBand
          title="Document retention"
          subtitle={`Rejected documents stay in the system for ${RETENTION_DAYS} days so they can be reinstated with approval — after that they are purged and the checklist row returns to pending`}
          stats={[
            {
              icon: <ArchiveIcon className="size-4" />,
              label: "Rejected documents",
              value: String(rows.length),
              caption: "inside the retention window",
            },
            {
              icon: <RotateCcwIcon className="size-4" />,
              label: "Awaiting your decision",
              value: String(pendingDecision),
              caption: "reinstatement requested",
              accent: pendingDecision > 0 ? "amber" : undefined,
            },
            {
              icon: <ClockIcon className="size-4" />,
              label: "Held from purge",
              value: String(held),
              caption: "a reinstatement stops the clock",
              accent: "teal",
            },
            {
              icon: <TriangleAlertIcon className="size-4" />,
              label: "Expiring within 14 days",
              value: String(expiringSoon),
              caption: "purged unless reinstated",
              accent: expiringSoon > 0 ? "rose" : undefined,
            },
          ]}
        />

        <RetentionClient rows={rows} retentionDays={RETENTION_DAYS} />
      </div>
    </PortalShell>
  );
}

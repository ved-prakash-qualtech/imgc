import { RetentionClient } from "@/app/[locale]/(portal)/admin/retention/RetentionClient";
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

  return (
    <PortalShell activeKey="admin-retention" title="Document Retention">
      <div className="space-y-4">
        <RetentionClient rows={rows} retentionDays={RETENTION_DAYS} />
      </div>
    </PortalShell>
  );
}

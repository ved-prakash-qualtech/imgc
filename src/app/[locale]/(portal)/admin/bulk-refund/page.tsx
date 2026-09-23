import { BulkRefundClient } from "@/app/[locale]/(portal)/admin/bulk-refund/BulkRefundClient";
import { PortalShell } from "@/components/portal/PortalShell";

export const dynamic = "force-dynamic";

/** IMGC only. */
export default async function BulkRefundPage() {
  return (
    <PortalShell activeKey="admin-bulk-refund" title="Bulk Refund Upload">
      <BulkRefundClient />
    </PortalShell>
  );
}

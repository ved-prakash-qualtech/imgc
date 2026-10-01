import { getTranslations } from "next-intl/server";
import { RetentionClient } from "@/app/[locale]/(portal)/admin/retention/RetentionClient";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  listRejectedDocuments,
  sweepExpiredRejections,
} from "@imgc/data/services/portal/retention.server";

export const dynamic = "force-dynamic";

/** IMGC only. */
export default async function RetentionPage() {
  const session = await requireSession();
  await sweepExpiredRejections();
  const rows = await listRejectedDocuments(session);

  const tTitles = await getTranslations("shell.pageTitles");
  return (
    <PortalShell
      activeKey="admin-retention"
      title={tTitles("documentRetention")}
    >
      <div className="space-y-4">
        <RetentionClient rows={rows} />
      </div>
    </PortalShell>
  );
}

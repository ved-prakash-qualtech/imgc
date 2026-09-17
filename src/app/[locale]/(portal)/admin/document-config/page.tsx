import { DocumentConfigClient } from "@/app/[locale]/(portal)/admin/document-config/DocumentConfigClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import {
  getLenderDocumentConfig,
  listLendersForConfig,
} from "@/services/portal/lenderDocumentConfig.server";

export const dynamic = "force-dynamic";

/**
 * "Lender Document Configuration" — IMGC only (`DashboardShell` refuses anyone else via
 * `activeKey="admin-doc-config"`, which only IMGC's own `navFor()` grants).
 *
 * The selected lender lives in `?lender=`, the same pattern the Claim Dashboard's own lender
 * picker uses: the client component just pushes the param, this server component re-fetches that
 * lender's configuration and hands it down fresh — no client-side fetch of its own to keep in
 * sync.
 */
export default async function DocumentConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ lender?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const lenders = await listLendersForConfig(session);
  const selectedLenderId =
    sp.lender && lenders.some((l) => l.id === sp.lender)
      ? sp.lender
      : (lenders[0]?.id ?? null);
  const rows = selectedLenderId
    ? await getLenderDocumentConfig(session, selectedLenderId)
    : [];

  return (
    <PortalShell activeKey="admin-doc-config" title="Document Configuration">
      <DocumentConfigClient
        key={selectedLenderId}
        lenders={lenders}
        selectedLenderId={selectedLenderId}
        initialRows={rows}
      />
    </PortalShell>
  );
}

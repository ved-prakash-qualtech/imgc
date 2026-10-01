import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/route";
import { AppearanceStudioClient } from "@/components/portal/AppearanceStudioClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import {
  getLenderBranding,
  listLendersForBranding,
} from "@/services/portal/brandingConfig.server";

export const dynamic = "force-dynamic";

/**
 * "Appearance Studio & Personalization" — IMGC Administration scope.
 * Gated to IMGC staff.
 * Full authority to manage Organization themes, color presets, titles, and logos per lender scope.
 */
export default async function AdminBrandingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; lender?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "IMGC") {
    redirect(ROUTES.personalization);
  }
  const sp = await searchParams;

  const lenders = await listLendersForBranding(session);
  const targetOrgId = sp.org || sp.lender;
  const selectedLenderId =
    targetOrgId && lenders.some((l) => l.id === targetOrgId)
      ? targetOrgId
      : (lenders[0]?.id ?? "org_abc");

  const initialBranding = selectedLenderId
    ? await getLenderBranding(session, selectedLenderId)
    : null;

  return (
    <PortalShell activeKey="admin-branding" title="Logos & Branding" fullHeight>
      <AppearanceStudioClient
        key={selectedLenderId ?? "none"}
        mode="admin"
        availableLenders={lenders}
        currentLenderOrgId={selectedLenderId}
        initialBranding={initialBranding}
        userName={session.name}
        userRole={session.isAdmin ? "Administrator" : "IMGC Reviewer"}
      />
    </PortalShell>
  );
}

import { AppearanceStudioClient } from "@imgc/features/portal/AppearanceStudioClient";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import { getUserPersonalization } from "@imgc/data/services/portal/brandingConfig.server";

export const dynamic = "force-dynamic";

/**
 * "Appearance Studio & Personalization" — Individual User Personalization Scope.
 * Accessible to any authenticated user (Lender officers).
 * IMGC staff are redirected to admin branding where they can choose lender scope.
 */
export default async function UserPersonalizationPage() {
  const session = await requireSession();
  const personalization = await getUserPersonalization(session);

  return (
    <PortalShell
      activeKey="personalization"
      title="Appearance Studio"
      fullHeight
    >
      <AppearanceStudioClient
        mode="user"
        initialPersonalization={personalization}
        userName={session.name}
        userRole={session.role === "IMGC" ? "IMGC Reviewer" : "Lender Officer"}
      />
    </PortalShell>
  );
}

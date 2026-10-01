import { redirect } from "next/navigation";
import { ROUTES } from "@imgc/constants/route";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import { listLenderOrgs } from "@imgc/data/services/portal/users.server";
import { AdminWorkspaceClient } from "@/app/[locale]/(portal)/admin/workspace/AdminWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function AdminWorkspacePage() {
  const session = await requireSession();
  if (session.role !== "IMGC") {
    redirect(ROUTES.claimDashboard);
  }

  const orgs = await listLenderOrgs();

  return (
    <PortalShell activeKey="admin-workspace" title="Admin Workspace">
      <AdminWorkspaceClient orgs={orgs} />
    </PortalShell>
  );
}

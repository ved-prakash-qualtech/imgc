import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/route";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listLenderOrgs } from "@/services/portal/users.server";
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

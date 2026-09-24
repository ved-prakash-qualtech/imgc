import { forbidden } from "next/navigation";
import { requireSession } from "@/lib/auth/appSession";
import { listLenderOrgs } from "@/services/portal/users.server";
import { AdminWorkspaceClient } from "@/app/[locale]/(portal)/admin/workspace/AdminWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function AdminWorkspacePage() {
  const session = await requireSession();

  if (session.role !== "IMGC" || !session.isAdmin) {
    forbidden();
  }

  const orgs = await listLenderOrgs();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <AdminWorkspaceClient orgs={orgs} />
    </div>
  );
}

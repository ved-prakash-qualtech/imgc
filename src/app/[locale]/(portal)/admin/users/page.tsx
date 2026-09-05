import { BuildingIcon, ShieldIcon, UserPlusIcon, UsersIcon } from "lucide-react";

import { UsersClient } from "@/app/[locale]/(portal)/admin/users/UsersClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import { listLenderOrgs, listUsers } from "@/services/portal/users.server";

export const dynamic = "force-dynamic";

/** IMGC only. */
export default async function AdminUsersPage() {
  const session = await requireSession();
  const [users, orgs] = await Promise.all([listUsers(session), listLenderOrgs()]);

  const lenders = users.filter((u) => u.role === "LENDER").length;
  const staff = users.filter((u) => u.role === "IMGC").length;
  const domains = new Set(orgs.map((o) => o.emailDomain)).size;

  return (
    <PortalShell activeKey="admin-users" title="Lender Access">
      <div className="space-y-4">
        <CommandBand
          title="Lender access"
          subtitle="Grant a lender their first sign-in — they authenticate with a one-time code sent to that address, and see only their organisation's accounts"
          stats={[
            {
              icon: <UsersIcon className="size-4" />,
              label: "Lender users",
              value: String(lenders),
              caption: "sign in with an emailed code",
              accent: "teal",
            },
            {
              icon: <ShieldIcon className="size-4" />,
              label: "IMGC staff",
              value: String(staff),
              caption: "sign in with an Employee ID",
            },
            {
              icon: <BuildingIcon className="size-4" />,
              label: "Lender organisations",
              value: String(orgs.length),
              caption: `${domains} email domain(s)`,
            },
            {
              icon: <UserPlusIcon className="size-4" />,
              label: "Scoping rule",
              value: "Domain",
              caption: "email domain decides what is visible",
            },
          ]}
        />

        <UsersClient users={users} orgs={orgs} />
      </div>
    </PortalShell>
  );
}

/* eslint-disable react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-jsx-as-prop, security/detect-object-injection -- KPI tiles are built from a fixed, locally-declared map; the keys are literals in this file, not input. */
import {
  AtSignIcon,
  BuildingIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { UsersClient } from "@/app/[locale]/(portal)/admin/users/UsersClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { getTranslations } from "next-intl/server";

import { requireSession } from "@/lib/auth/appSession";
import { cn } from "@/lib/utils/twMergeUtils";
import { listLenderOrgs, listUsers } from "@/services/portal/users.server";

export const dynamic = "force-dynamic";

/** Same tile palette the Claims Overview band uses, so the two headers read as one system. */
const TONE = {
  blue: { border: "border-info/30", icon: "bg-info/10 text-info" },
  rose: {
    border: "border-destructive/30",
    icon: "bg-destructive/10 text-destructive",
  },
  amber: { border: "border-warning/30", icon: "bg-warning/10 text-warning" },
  violet: {
    border: "border-brand-primary/30",
    icon: "bg-brand-primary/10 text-brand-primary",
  },
  gold: {
    border: "border-brand-on-dark/50",
    icon: "bg-brand-on-dark/20 text-brand-on-dark-strong",
  },
} as const;

/**
 * One white KPI card on the band — the Claims Overview tile shape (big number, icon chip, label
 * underneath) rather than the translucent `BandStat`, so both headers in the portal look alike.
 * Rendered through `CommandBand`'s `children` slot, which exists for exactly this: per-card
 * styling that the shared translucent grid cannot express. Neither shared component is modified,
 * so no other page that uses them is touched.
 */
function StatTile({
  value,
  label,
  icon,
  tone,
  title,
  href,
}: Readonly<{
  value: number;
  label: string;
  icon: React.ReactNode;
  tone: keyof typeof TONE;
  title: string;
  /** Where the tile drills into. The table below reads the same params back out (see
   *  `roleFromParam` / `orgFilterFromParam` in UsersClient), so the click and the count it came
   *  from always describe the same set of rows. */
  href: string;
}>) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "flex cursor-pointer flex-col rounded-xl border bg-white px-3.5 py-1.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-neutral-50 hover:shadow-md",
        TONE[tone].border
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-outfit text-ui-display-sm font-bold leading-none text-neutral-900">
          {String(value).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            TONE[tone].icon
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 truncate text-ui-body font-medium text-neutral-500">
        {label}
      </p>
    </Link>
  );
}

/** IMGC only. */
export default async function AdminUsersPage() {
  const t = await getTranslations("admin.lenderAccess");
  const session = await requireSession();
  const [users, orgs] = await Promise.all([
    listUsers(session),
    listLenderOrgs(),
  ]);

  const lenders = users.filter((u) => u.role === "LENDER").length;
  const staff = users.filter((u) => u.role === "IMGC").length;
  const domains = new Set(orgs.map((o) => o.emailDomain)).size;

  // An organisation nobody can sign in as yet — onboarded, but with its first access not granted.
  // Derived from the same user list the table's own "Users" column counts, so the band and the
  // rows below it can never disagree.
  const orgsWithUsers = new Set(
    users.map((u) => u.lenderOrgId).filter((id): id is string => Boolean(id))
  );
  const awaitingFirstUser = orgs.filter((o) => !orgsWithUsers.has(o.id)).length;

  return (
    <PortalShell activeKey="admin-users" title={t("pageTitle")}>
      <div className="space-y-2">
        <CommandBand title="" stats={[]}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            <StatTile
              value={orgs.length}
              label={t("tiles.organisations")}
              icon={<BuildingIcon className="size-4" />}
              tone="blue"
              title={t("tiles.organisationsHint")}
              href="/admin/users?tab=organisations&orgs=ALL"
            />
            <StatTile
              value={lenders}
              label={t("tiles.lenderUsers")}
              icon={<UsersIcon className="size-4" />}
              tone="violet"
              title={t("tiles.lenderUsersHint")}
              href="/admin/users?tab=users&role=LENDER"
            />
            <StatTile
              value={staff}
              label={t("tiles.imgcStaff")}
              icon={<ShieldIcon className="size-4" />}
              tone="amber"
              title={t("tiles.imgcStaffHint")}
              href="/admin/users?tab=users&role=IMGC"
            />
            <StatTile
              value={domains}
              label={t("tiles.emailDomains")}
              icon={<AtSignIcon className="size-4" />}
              tone="gold"
              title={t("tiles.emailDomainsHint")}
              href="/admin/users?tab=organisations&orgs=ALL"
            />
            <StatTile
              value={awaitingFirstUser}
              label={t("tiles.awaitingFirstUser")}
              icon={<UserPlusIcon className="size-4" />}
              tone="rose"
              title={t("tiles.awaitingFirstUserHint")}
              href="/admin/users?tab=organisations&orgs=AWAITING"
            />
          </div>
        </CommandBand>

        <UsersClient users={users} orgs={orgs} />
      </div>
    </PortalShell>
  );
}

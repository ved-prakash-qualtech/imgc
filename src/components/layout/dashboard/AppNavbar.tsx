"use client";

import Image from "next/image";
import {
  BellIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  ClockIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  PaletteIcon,
  PhoneIcon,
  StampIcon,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/constants/route";
import type { SessionUser } from "@/lib/auth/session";

/** The IMGC officer the Help card should point to — kept local rather than imported from the
 *  server service so this client component never pulls in a "server-only" module. */
export type HelpContact = Readonly<{
  name: string;
  email: string;
  phone?: string;
}>;

// Real IMGC corporate helpline/email, from imgc.com/contact-us — not a placeholder.
const GENERAL_DESK: HelpContact = {
  name: "IMGC Support Desk",
  email: "info@imgc.com",
  phone: "+91-120-489-8000",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export type AppNavbarProps = Readonly<{
  title?: string;
  /** Shown beside the title, smaller — e.g. the claim amount on a claim screen. */
  titleAside?: string;
  /** Live ageing timer to display beside the claim amount. */
  claimAgeing?: React.ReactNode;
  /** Whose workspace this is — the tenant's short code, or the admin scope. */
  workspace?: string;
  user?: SessionUser | null;
  /** Unread notification count for the bell badge. */
  unreadCount?: number;
  /** The officer handling most of this lender's cases. Absent for IMGC sessions and lenders
   *  with no assigned cases yet — the Help card falls back to the general desk. */
  assignedOfficer?: HelpContact | null;
  /** When provided, renders a hamburger button on the far-left that triggers this callback. */
  onMenuClick?: () => void;
  /** When present, shows the highly-visible admin context banner. */
  adminContextName?: string | null;
  /** Whether the user belongs to IMGC staff. */
  isImgc?: boolean;
  /** Lender logo to show on the left side of navbar before page title (Lender sessions only). */
  lenderLogoUrl?: string;
  /** Lender name for accessibility alt tag. */
  lenderName?: string;
}>;

export function AppNavbar({
  title = "Dashboard",
  titleAside,
  claimAgeing,
  workspace,
  user,
  unreadCount = 0,
  assignedOfficer,
  onMenuClick,
  adminContextName,
  isImgc,
  lenderLogoUrl,
  lenderName,
}: AppNavbarProps) {
  const t = useTranslations("shell.navbar");
  const contact = assignedOfficer ?? GENERAL_DESK;
  const isPersonal = Boolean(assignedOfficer);
  const pathname = usePathname();
  const isBrandingActive = Boolean(pathname?.includes("/admin/branding"));
  const isPersonalizationActive = Boolean(pathname?.includes("/personalization"));
  return (
    <div className="flex flex-col shrink-0">
      {adminContextName && (
        <div className="flex items-center justify-between bg-brand-primary px-5 py-2 text-white shadow-sm transition-colors">
          <div className="text-[13px] font-semibold">
            Acting on behalf of: {adminContextName}
          </div>
          <div className="flex gap-4 text-[12px] font-medium">
            <Link href={ROUTES.adminWorkspace} className="hover:underline">
              Change Lender
            </Link>
            <form action="/api/auth/exit-admin-context" method="POST">
              <button type="submit" className="hover:underline text-white/90">
                Exit Context
              </button>
            </form>
          </div>
        </div>
      )}
      <header className="flex h-14 items-center justify-between border-b border-neutral-100 bg-white px-5">
        {/* Left: optional hamburger + workspace + page title */}
        <div className="flex items-center gap-3 text-sm">
          {/* Lender Logo (Rendered on left side before page title, for lender users only) */}
          {(!isImgc || Boolean(adminContextName)) && (lenderLogoUrl || lenderName) && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative flex h-8 max-w-[140px] items-center justify-center rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1 shadow-2xs">
                {lenderLogoUrl ? (
                  <Image
                    src={lenderLogoUrl}
                    alt={lenderName ?? "Lender Logo"}
                    width={95}
                    height={24}
                    className="max-h-6 w-auto object-contain"
                    priority
                    unoptimized={Boolean(lenderLogoUrl.startsWith("http") || lenderLogoUrl.startsWith("data:"))}
                  />
                ) : (
                  <span className="font-outfit text-xs font-bold text-neutral-800 tracking-wide">
                    {lenderName}
                  </span>
                )}
              </div>
              <span aria-hidden className="h-5 w-px bg-neutral-200" />
            </div>
          )}

          <div className="flex items-center gap-2">
            {titleAside ? (
              // A claim screen: claim number and amount set as one matching pair of label + value.
              <span className="text-ui-subhead font-semibold tabular-nums text-neutral-800">
                <span className="mr-1 text-ui-body-sm font-medium text-neutral-500">
                  Claim No.
                </span>
                {title.replace(/^Claim No\.\s*/, "")}
              </span>
            ) : (
              <span className="font-outfit text-ui-display-sm font-semibold leading-6 tracking-[1%] text-neutral-900">
                {title}
              </span>
            )}
            {titleAside && (
              <>
                <span aria-hidden className="h-4 w-px bg-neutral-200" />
                <span className="text-ui-subhead font-semibold tabular-nums text-neutral-800">
                  <span className="mr-1 text-ui-body-sm font-medium text-neutral-500">
                    Claim Amount
                  </span>
                  {titleAside}
                </span>
              </>
            )}
            {claimAgeing && (
              <>
                <span aria-hidden className="h-4 w-px bg-neutral-200" />
                <span className="text-ui-subhead font-semibold text-neutral-800">
                  <span className="mr-1 text-ui-body-sm font-medium text-neutral-500">
                    {t("ageing")}
                  </span>
                  {claimAgeing}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: notifications, help, account menu */}
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.notifications}
            aria-label={
              unreadCount > 0
                ? t("notificationsUnread", { count: unreadCount })
                : t("notifications")
            }
            className="relative grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
          >
            <BellIcon className="size-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-ui-tiny font-bold leading-4 text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {/* Institutional Logos & Branding (IMGC Administration scope only) */}
          {isImgc && (
            <Link
              href={ROUTES.adminBranding}
              aria-label="Logos & Institutional Branding"
              title="Logos & Institutional Branding"
              className={`grid size-8 place-items-center rounded-full transition-colors ${
                isBrandingActive
                  ? "bg-neutral-100 text-neutral-900 font-bold shadow-2xs"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
              }`}
            >
              <StampIcon className="size-[18px]" />
            </Link>
          )}

          {/* Personal Appearance & Personalization (All users) */}
          <Link
            href={ROUTES.personalization}
            aria-label="Appearance Studio & Personalization"
            title="Appearance Studio & Personalization"
            className={`grid size-8 place-items-center rounded-full transition-colors ${
              isPersonalizationActive
                ? "bg-neutral-100 text-neutral-900 font-bold shadow-2xs"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
            }`}
          >
            <PaletteIcon className="size-[18px]" />
          </Link>

          <Popover>
            <PopoverTrigger
              className="grid size-8 cursor-pointer place-items-center rounded-full text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
              aria-label={t("help")}
            >
              <CircleHelpIcon className="size-[18px]" />
            </PopoverTrigger>

            <PopoverContent align="end" className="w-80 gap-0 p-0">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <div>
                  <p className="text-ui-subhead-lg font-semibold text-neutral-950">
                    {t("helpTitle")}
                  </p>
                  <p className="text-ui-body-sm text-neutral-500">
                    {t("helpSubtitle")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-ui-label font-semibold text-success-700">
                  <span className="size-1.5 rounded-full bg-success-500" />
                  {t("liveDesk")}
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-25 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-primary text-ui-body font-semibold text-white">
                      {initialsOf(contact.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-ui-subhead font-semibold text-neutral-950">
                        {contact.name}
                      </p>
                      <p className="truncate text-ui-body-sm text-neutral-500">
                        {isPersonal
                          ? t("dedicatedManager")
                          : t("generalEnquiries")}
                      </p>
                    </div>
                  </div>
                  {isPersonal && (
                    <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-ui-caption font-semibold text-brand-primary">
                      {t("priorityDesk")}
                    </span>
                  )}
                </div>

                <a
                  href={`mailto:${contact.email}`}
                  className="mt-2 flex items-center justify-between rounded-lg px-2 py-2 text-ui-body-lg text-neutral-700 hover:bg-neutral-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MailIcon className="size-4 shrink-0 text-neutral-400" />
                    <span className="truncate">{contact.email}</span>
                  </span>
                  <ChevronRightIcon className="size-3.5 shrink-0 text-neutral-400" />
                </a>

                {contact.phone && (
                  <a
                    href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-ui-body-lg text-neutral-700 hover:bg-neutral-50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PhoneIcon className="size-4 shrink-0 text-neutral-400" />
                      <span>{contact.phone}</span>
                    </span>
                    {isPersonal && (
                      <span className="shrink-0 text-ui-label font-medium text-brand-primary">
                        {t("directLine")}
                      </span>
                    )}
                  </a>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-ui-label text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    {t("hours")}
                  </span>
                  <span>{t("fastResponse")}</span>
                </div>
              </div>

              {isPersonal && (
                <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-25 px-4 py-2.5 text-ui-body-sm">
                  <span className="text-neutral-500">{t("generalCare")}</span>
                  <a
                    href={`tel:${GENERAL_DESK.phone!.replace(/[^+\d]/g, "")}`}
                    className="font-semibold text-brand-primary hover:underline"
                  >
                    {GENERAL_DESK.phone}
                  </a>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <span aria-hidden className="h-6 w-px bg-neutral-100" />

          <Popover>
            <PopoverTrigger
              className="flex cursor-pointer items-center gap-2"
              aria-label={t("accountMenu")}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-white">
                {user?.initials ?? "?"}
              </span>
              <span className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-ui-subhead font-semibold text-neutral-950">
                  {user?.name ?? t("signedIn")}
                </span>
                {user?.roleLabel && (
                  <span className="text-ui-body-sm text-neutral-500">
                    {user.roleLabel}
                  </span>
                )}
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-neutral-500" />
            </PopoverTrigger>

            <PopoverContent align="end" className="w-64 gap-0 p-0">
              <div className="border-b border-neutral-100 px-3 py-2.5">
                <p className="truncate text-ui-subhead-lg font-semibold text-neutral-950">
                  {user?.name ?? t("signedIn")}
                </p>
                {user?.email && (
                  <p className="truncate text-ui-body text-neutral-500">
                    {user.email}
                  </p>
                )}
              </div>
              {/*
               * A plain anchor, deliberately. Sign-out is a full-page journey: the route handler
               * clears the cookies and then hands the browser to Keycloak's end-session endpoint,
               * so the realm session ends too. A client-side navigation would never leave the app.
               * No locale prefix — /api is outside the localized routes.
               */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a client-side
                navigation would keep the browser inside the app, and this destination has to
                leave it: the handler redirects on to Keycloak's end-session endpoint. */}
              <a
                href="/api/auth/logout"
                className="flex items-center gap-2 px-3 py-2.5 text-ui-subhead-lg font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <LogOutIcon className="size-4" />
                {t("signOut")}
              </a>
            </PopoverContent>
          </Popover>
        </div>
      </header>
    </div>
  );
}

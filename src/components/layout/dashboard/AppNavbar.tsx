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
  PhoneIcon,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
}>;

export function AppNavbar({
  title = "Dashboard",
  workspace,
  user,
  unreadCount = 0,
  assignedOfficer,
  onMenuClick,
}: AppNavbarProps) {
  const contact = assignedOfficer ?? GENERAL_DESK;
  const isPersonal = Boolean(assignedOfficer);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 bg-white px-5">
      {/* Left: optional hamburger + workspace + page title */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-outfit text-[20px] font-semibold leading-6 tracking-[1%] align-middle text-neutral-900">
            {title}
          </span>
        </div>
      </div>

      {/* Right: notifications, help, account menu */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.notifications}
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="relative grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
        >
          <BellIcon className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <Popover>
          <PopoverTrigger
            className="grid size-8 cursor-pointer place-items-center rounded-full text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
            aria-label="Help & Assistance"
          >
            <CircleHelpIcon className="size-[18px]" />
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80 gap-0 p-0">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div>
                <p className="text-[13.5px] font-semibold text-neutral-950">
                  Help &amp; Assistance
                </p>
                <p className="text-[11.5px] text-neutral-500">
                  Priority Lending Desk
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
                <span className="size-1.5 rounded-full bg-success-500" />
                Live Desk
              </span>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-25 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-primary text-[12px] font-semibold text-white">
                    {initialsOf(contact.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-neutral-950">
                      {contact.name}
                    </p>
                    <p className="truncate text-[11.5px] text-neutral-500">
                      {isPersonal ? "Dedicated Loan Manager" : "General enquiries"}
                    </p>
                  </div>
                </div>
                {isPersonal && (
                  <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-primary">
                    Priority Desk
                  </span>
                )}
              </div>

              <a
                href={`mailto:${contact.email}`}
                className="mt-2 flex items-center justify-between rounded-lg px-2 py-2 text-[12.5px] text-neutral-700 hover:bg-neutral-50"
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
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-[12.5px] text-neutral-700 hover:bg-neutral-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <PhoneIcon className="size-4 shrink-0 text-neutral-400" />
                    <span>{contact.phone}</span>
                  </span>
                  {isPersonal && (
                    <span className="shrink-0 text-[11px] font-medium text-brand-primary">
                      Direct Line
                    </span>
                  )}
                </a>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="size-3.5" />
                  Mon – Sat (9 AM – 7 PM IST)
                </span>
                <span>Fast Response</span>
              </div>
            </div>

            {isPersonal && (
              <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-25 px-4 py-2.5 text-[11.5px]">
                <span className="text-neutral-500">General Customer Care (24x7)</span>
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
            aria-label="Account menu"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-white">
              {user?.initials ?? "?"}
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-[13px] font-semibold text-neutral-950">
                {user?.name ?? "Signed in"}
              </span>
              {user?.roleLabel && (
                <span className="text-[11.5px] text-neutral-500">
                  {user.roleLabel}
                </span>
              )}
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-neutral-500" />
          </PopoverTrigger>

          <PopoverContent align="end" className="w-64 gap-0 p-0">
            <div className="border-b border-neutral-100 px-3 py-2.5">
              <p className="truncate text-[13.5px] font-semibold text-neutral-950">
                {user?.name ?? "Signed in"}
              </p>
              {user?.email && (
                <p className="truncate text-[12px] text-neutral-500">
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
              className="flex items-center gap-2 px-3 py-2.5 text-[13.5px] font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <LogOutIcon className="size-4" />
              Sign out
            </a>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

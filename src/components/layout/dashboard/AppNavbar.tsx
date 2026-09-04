"use client";

import { ChevronDownIcon, LogOutIcon, MenuIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SessionUser } from "@/lib/auth/session";

export type AppNavbarProps = Readonly<{
  title?: string;
  /** Whose workspace this is — the tenant's short code, or the admin scope. */
  workspace?: string;
  user?: SessionUser | null;
  /** When provided, renders a hamburger button on the far-left that triggers this callback. */
  onMenuClick?: () => void;
}>;

export function AppNavbar({
  title = "Dashboard",
  workspace,
  user,
  onMenuClick,
}: AppNavbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 bg-white px-5">
      {/* Left: optional hamburger + workspace + page title */}
      <div className="flex items-center gap-3 text-sm">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="cursor-pointer text-neutral-500 hover:text-neutral-800"
          >
            <MenuIcon className="size-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          {workspace && (
            <>
              <span className="font-semibold text-neutral-950">
                {workspace}
              </span>
              <span className="text-neutral-300">|</span>
            </>
          )}
          <span className="font-outfit text-[20px] font-semibold leading-6 tracking-[1%] align-middle text-neutral-900">
            {title}
          </span>
        </div>
      </div>

      {/* Right: account menu */}
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger
            className="flex cursor-pointer items-center gap-1"
            aria-label="Account menu"
          >
            <span className="grid size-8 place-items-center rounded-full bg-brand-primary text-xs font-semibold text-white">
              {user?.initials ?? "?"}
            </span>
            <ChevronDownIcon className="size-3.5 text-neutral-500" />
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
              Logout
            </a>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

"use client";

import { useCallback, useState } from "react";

import {
  AppNavbar,
  type AppNavbarProps,
} from "@imgc/features/layout/dashboard/AppNavbar";
import {
  AppSidebar,
  type AppSidebarProps,
} from "@imgc/features/layout/dashboard/AppSidebar";

/**
 * The one bit of shared state a mobile nav drawer needs: whether it's open, and the hamburger
 * button that opens it. Split out from `DashboardShell` so that server component can keep doing
 * its own access check (`forbidden()`) without becoming a client component itself — this is the
 * only part of the shell that's actually interactive.
 *
 * `AppSidebar`'s `overlay` mode and `AppNavbar`'s `onMenuClick` hamburger already existed; nothing
 * before this wired them together, so the drawer was unreachable and the rail sidebar rendered at
 * full width on every viewport, mobile included.
 */
export function MobileNavShell({
  navbarProps,
  sidebarProps,
}: Readonly<{
  navbarProps: Omit<AppNavbarProps, "onMenuClick">;
  sidebarProps: Pick<
    AppSidebarProps,
    "items" | "activeKey" | "badges" | "sectionLabel"
  >;
}>) {
  const [open, setOpen] = useState(false);
  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);

  return (
    <>
      <AppNavbar {...navbarProps} onMenuClick={openMenu} />
      <AppSidebar {...sidebarProps} overlay open={open} onClose={closeMenu} />
    </>
  );
}

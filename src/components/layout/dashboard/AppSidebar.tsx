"use client";

import { createElement, useCallback, useState } from "react";
import Image from "next/image";
import {
  ArchiveIcon,
  BellIcon,
  BuildingIcon,
  ChevronDownIcon,
  CircleDotIcon,
  FileCheck2Icon,
  FolderOpenIcon,
  InboxIcon,
  KeyRoundIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  MenuIcon,
  ShieldIcon,
  TerminalIcon,
  UsersIcon,
  FilePlusIcon,
  MessageCircleIcon,
  ListTreeIcon,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import type { NavItem, NavKey } from "@/constants/nav";
import { cn } from "@/lib/utils/twMergeUtils";

/**
 * The client side of the nav contract: `key` in, icon out. See constants/nav.ts.
 *
 * Partial, and read through {@link NavIcon}. The sidebar is built from `auth.sidebar_menus`, so a
 * menu can be added by INSERT — and it would be a poor trade if adding a row could crash the
 * whole nav because nobody had picked an icon for it yet. An unknown code gets a neutral dot and
 * the menu still works.
 *
 * A Map rather than an object, because the key is a database value: indexing an object by one
 * also reaches what the object inherits, and `constructor` is not an icon.
 */
const ICONS = new Map<NavKey, typeof LayoutDashboardIcon>([
  ["dashboard", LayoutDashboardIcon],
  ["accounts", FolderOpenIcon],
  ["initiate-claim", FilePlusIcon],
  ["track-query-response", MessageCircleIcon],
  ["audit-trail", ListTreeIcon],
  ["additional-documents", FileCheck2Icon],
  ["buckets", InboxIcon],
  ["notifications", BellIcon],
  ["administration", ShieldIcon],
  ["admin-users", UsersIcon],
  ["admin-retention", ArchiveIcon],
  // Retained from the base template.
  ["tenants", BuildingIcon],
  ["menus", LayoutListIcon],
  ["application-management", LayersIcon],
  ["roles", KeyRoundIcon],
  ["users", UsersIcon],
  ["api-clients", TerminalIcon],
]);

/**
 * The icon for one nav key.
 *
 * <p>A component rather than a `const Icon = iconFor(key)` in each caller: assigning a component
 * to a capitalised local during render is indistinguishable, to the React compiler, from defining
 * one there — and a component defined during render loses its state on every pass. Looking the
 * entry up inside a component declared at module scope says what is actually happening, which is
 * a table read.
 */
function NavIcon({
  navKey,
  className,
}: Readonly<{ navKey: NavKey; className?: string }>) {
  // createElement rather than `const Icon = …; <Icon />`: a capitalised local holding the result
  // of a call is, to the React compiler, a component defined during render — and one of those
  // loses its state every pass. Saying "make an element of this type" leaves nothing to misread.
  return createElement(ICONS.get(navKey) ?? CircleDotIcon, { className });
}

type SidebarNavLinkProps = Readonly<{
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  /** Unread count for this item, if any. */
  badge?: number;
}>;

function SidebarNavLink({
  item,
  active,
  collapsed,
  badge,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={item.href ?? "#"}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg text-left text-[13.5px] font-medium transition-colors",
        collapsed ? "w-full justify-center px-0 py-2.5" : "w-full px-3 py-2",
        active
          ? "bg-[linear-gradient(90deg,#f37819_0%,#c25c0d_100%)] text-white"
          : "text-sidebar-text-muted hover:bg-white/5 hover:text-white"
      )}
    >
      <NavIcon navKey={item.key} className="size-4 shrink-0" />
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      )}
      {badge ? (
        <span
          aria-label={`${badge} unread`}
          className={cn(
            "grid min-w-4.5 shrink-0 place-items-center rounded-full px-1.5 text-[10.5px] font-bold leading-4",
            collapsed ? "absolute right-2 top-1.5 size-4 px-0" : "",
            active ? "bg-white text-brand-primary" : "bg-destructive text-white"
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * A group of sections under one heading — Administration and its children.
 *
 * Expanded when one of its children is the active page, so arriving by URL shows where you are
 * rather than presenting a collapsed group that hides the highlighted item. Collapsed sidebars
 * show only the children's icons: a disclosure arrow with no label to disclose is noise.
 */
function SidebarNavGroup({
  item,
  activeKey,
  collapsed,
  badges,
}: Readonly<{
  item: NavItem;
  activeKey?: NavKey;
  collapsed: boolean;
  badges?: Partial<Record<NavKey, number>>;
}>) {
  const children = item.children ?? [];
  const holdsActive = children.some((child) => child.key === activeKey);
  const [open, setOpen] = useState(holdsActive);
  const toggleOpen = useCallback(() => setOpen((value) => !value), []);

  if (collapsed) {
    return (
      <>
        {children.map((child) => (
          <SidebarNavLink
            key={child.key}
            item={child}
            active={child.key === activeKey}
            collapsed
            badge={badges?.[child.key]}
          />
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors",
          holdsActive
            ? "text-white"
            : "text-sidebar-text-muted hover:bg-white/5 hover:text-white"
        )}
      >
        <NavIcon navKey={item.key} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open ? "" : "-rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-3">
          {children.map((child) => (
            <SidebarNavLink
              key={child.key}
              item={child}
              active={child.key === activeKey}
              collapsed={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type AppSidebarProps = Readonly<{
  badges?: Partial<Record<NavKey, number>>;
  items: NavItem[];
  /** Which item is highlighted. Passed in rather than derived from the URL: more than one item
   *  can point at the same route while sections are still being built. */
  activeKey?: NavKey;
  defaultCollapsed?: boolean;
  /** Overlay/drawer mode — sidebar floats over content instead of pushing it. */
  overlay?: boolean;
  /** Controls visibility in overlay mode (ignored in rail mode). */
  open?: boolean;
  /** Called when the user closes the sidebar in overlay mode. */
  onClose?: () => void;
}>;

export function AppSidebar({
  items,
  activeKey,
  badges,
  defaultCollapsed = false,
  overlay = false,
  open = false,
  onClose,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggle = useCallback(() => {
    if (overlay) {
      onClose?.();
    } else {
      setCollapsed((prev) => !prev);
    }
  }, [overlay, onClose]);

  /** In overlay mode the sidebar is always "expanded" visually. */
  const isCollapsed = overlay ? false : collapsed;

  if (overlay) {
    return (
      <>
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden
            onClick={onClose}
          />
        )}

        {/* Drawer panel */}
        <aside
          className={cn(
            "fixed left-0 top-0 z-50 flex h-full w-sidebar-w flex-col bg-sidebar-bg text-white shadow-2xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContents
            items={items}
            activeKey={activeKey}
            collapsed={false}
            onToggle={handleToggle}
            badges={badges}
          />
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-sidebar-bg text-white transition-[width] duration-200",
        isCollapsed ? "w-16" : "w-sidebar-w"
      )}
    >
      <SidebarContents
        items={items}
        activeKey={activeKey}
        collapsed={isCollapsed}
        onToggle={handleToggle}
        badges={badges}
      />
    </aside>
  );
}

type SidebarContentsProps = Readonly<{
  items: NavItem[];
  activeKey?: NavKey;
  collapsed: boolean;
  onToggle: () => void;
  badges?: Partial<Record<NavKey, number>>;
}>;

function SidebarContents({
  items,
  activeKey,
  collapsed,
  onToggle,
  badges,
}: SidebarContentsProps) {
  return (
    <>
      {/* Header */}
      <div
        className={cn(
          "flex items-center py-4",
          collapsed ? "flex-col gap-2 px-2" : "justify-between px-4"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1.5",
            collapsed && "flex-col gap-2"
          )}
        >
          <Image
            src="/assets/icons/imgc-mark.svg"
            alt=""
            width={24}
            height={24}
            aria-hidden
          />
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-wide">
                IMGC
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-sidebar-text-muted">
                Defining Tomorrow
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="cursor-pointer text-sidebar-text-muted hover:text-white"
        >
          <MenuIcon className="size-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
        {/*
          No section heading.

          There was one, and it read "Main" — printed once, above the whole nav, with nothing
          beside it to be distinguished from. A heading that labels everything labels nothing; it
          took a line of the rail to say the menu is the menu.

          A console with genuinely separate groups of nav should name them, and the space below is
          where those headings would go. This one has three items.
        */}
        {!collapsed && <div className="pt-2" />}
        {items.map((item) =>
          item.children?.length ? (
            <SidebarNavGroup
              key={item.key}
              item={item}
              activeKey={activeKey}
              collapsed={collapsed}
              badges={badges}
            />
          ) : (
            <SidebarNavLink
              key={item.key}
              item={item}
              active={item.key === activeKey}
              collapsed={collapsed}
              badge={badges?.[item.key]}
            />
          )
        )}
      </nav>
    </>
  );
}

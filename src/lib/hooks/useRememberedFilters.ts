"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Keeps a grid's filters applied across a round trip into a row and back.
 *
 * Both claim grids already mirror their filters into the URL, so a browser Back restores them.
 * What does not is returning by a link — "All accounts" and the claim workspace's own Back point
 * at the bare grid route, which arrives with no params and so with no filter. Reading a case
 * should not silently widen the list the reader came from.
 *
 * The filter lives on the *link*, not in a restore after the grid loads: `useRememberFilters`
 * records the grid's params, and `useRememberedHref` hands the way back a URL that already
 * carries them. So the grid renders filtered on its first paint. Restoring it afterwards would
 * work too, but the reader would watch every account appear and then vanish again.
 *
 * `sessionStorage` on purpose — this is one tab's working state, not a saved preference, and it
 * is gone when the tab is.
 */
const FILTER_PARAMS = ["status", "lender", "sort"] as const;

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // A private window or blocked storage just means no memory — never a broken grid.
  }
}

/** Records this grid's filter params as they change. Call it from the grid itself. */
export function useRememberFilters(storageKey: string): void {
  const searchParams = useSearchParams();
  const current = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(current);
    const own = new URLSearchParams();
    for (const name of FILTER_PARAMS) {
      const value = params.get(name);
      if (value) own.set(name, value);
    }
    write(storageKey, own.toString());
  }, [current, storageKey]);
}

/**
 * The way back to a grid, carrying whatever filter it was last left on.
 *
 * Read through `useSyncExternalStore` rather than an effect: the server has no `sessionStorage`,
 * so it renders the plain href, React hydrates against that same value, and only then does the
 * remembered one take over. No state written during render, and no mismatch.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function useRememberedHref(baseHref: string, storageKey: string): string {
  const remembered = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => ""
  );

  if (!remembered) return baseHref;
  return `${baseHref}${baseHref.includes("?") ? "&" : "?"}${remembered}`;
}

/** One key per grid — the two grids belong to different roles and never share a filter. */
export const ACCOUNTS_FILTER_KEY = "imgc.accounts.filters";
export const CLAIMS_FILTER_KEY = "lender.claims.filters";

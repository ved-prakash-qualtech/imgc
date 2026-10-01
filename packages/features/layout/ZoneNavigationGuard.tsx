"use client";

import { useEffect } from "react";

import { currentZone, zoneOfPath } from "@imgc/i18n/zones";

/**
 * Makes a link to another zone a full page load.
 *
 * Each zone is its own Next.js app with its own build. A soft client-side navigation to a path
 * another zone serves would ask that zone for a page payload and try to render it inside this
 * app's router — a mismatch Next cannot recover from. So a click that would leave the zone is
 * turned into an ordinary navigation before the router sees it.
 *
 * One listener on the document, in the capture phase, so it runs ahead of every `<Link>` and
 * needs no change at the call sites: a link inside the zone is left alone and stays a soft
 * navigation.
 */
export function ZoneNavigationGuard() {
  useEffect(() => {
    const here = currentZone();

    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (zoneOfPath(url.pathname) === here) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

/** Never changes after hydration, so there is nothing to subscribe to. */
const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Mounts the toaster in the browser only.
 *
 * <p>sonner's `Toaster` reads its queue through `useSyncExternalStore`, and its server snapshot is
 * not reference-stable — React logs "the result of getServerSnapshot should be cached to avoid an
 * infinite loop" on every server render, and on React 19 that can throw while hydrating. There is
 * nothing to gain from server-rendering it either way: an empty toast list renders nothing, and
 * the first toast can only ever be raised by something the user did in the browser.
 *
 * <p>Rendering after mount skips the server snapshot entirely, so the warning cannot arise. Pair
 * this with keeping it outside the app's error boundary — see the layout — so that a toaster
 * problem can never be mistaken for, or take down, the application itself.
 *
 * <p>Asked through `useSyncExternalStore` rather than a state-setting effect: "am I in the
 * browser" is exactly the question it exists to answer, it settles during hydration instead of
 * in a second render pass, and the three callbacks are module constants so the snapshot is
 * reference-stable — which is the very property sonner's own server snapshot lacks.
 */
export function ToasterMount() {
  const mounted = useSyncExternalStore(subscribe, onClient, onServer);

  return mounted ? <Toaster /> : null;
}

"use client";

import { useServerErrorMessage } from "@/lib/serverErrorMessage";
import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BuildingIcon } from "lucide-react";
import { toast } from "sonner";

import {
  enterAdminContextAction,
  exitAdminContextAction,
} from "@/app/[locale]/(portal)/admin/workspace/actions";

/**
 * Claim by IMGC — picking the lender IMGC is acting for, on the claims page itself.
 *
 * It sits above the grid rather than on a page of its own: choosing a lender is a filter on this
 * screen, not a destination. Once chosen, the navbar carries "Acting on behalf of …" with its
 * Exit Context control, so this bar's only job is the first choice and switching between lenders.
 */
export function LenderContextBar({
  orgs,
  currentOrgId,
}: Readonly<{
  orgs: ReadonlyArray<{ id: string; name: string }>;
  currentOrgId?: string | null;
}>) {
  const errorText = useServerErrorMessage();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("claim.claimDetail");
  const [selected, setSelected] = useState(currentOrgId ?? "");

  const choose = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const lenderOrgId = event.target.value;
      setSelected(lenderOrgId);
      if (!lenderOrgId) return;
      startTransition(async () => {
        const result = await enterAdminContextAction(lenderOrgId);
        const message = errorText(result);
        if (message) toast.error(message);
      });
    },
    [errorText]
  );

  // A server action, not a plain form POST: inside a client component React treats `action` as a
  // form action, and posting to the route handler that way dispatches a router action before the
  // router is ready ("Router action dispatched before initialization").
  const stop = useCallback(() => {
    startTransition(async () => {
      await exitAdminContextAction();
    });
  }, []);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-primary/25 bg-brand-light/50 px-3 py-2">
      <span className="flex items-center gap-1.5 text-ui-body-lg font-semibold text-brand-primary">
        <BuildingIcon className="size-4" />
        Claim by IMGC
      </span>
      <label className="flex items-center gap-2 text-ui-body-lg text-neutral-700">
        Acting for
        <select
          value={selected}
          onChange={choose}
          disabled={pending}
          aria-label={t("lenderContextLabel")}
          className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-ui-body-lg outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
        >
          <option value="">Select a lender…</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {currentOrgId ? (
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="ml-auto rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-ui-body font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-60"
        >
          Stop acting for this lender
        </button>
      ) : (
        <span className="text-ui-body text-neutral-500">
          Pick the lender first — the claims below are theirs, and a claim you
          initiate is recorded as started by IMGC on their behalf.
        </span>
      )}
    </div>
  );
}

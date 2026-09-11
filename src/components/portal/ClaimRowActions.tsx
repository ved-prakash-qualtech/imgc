/* eslint-disable react-perf/jsx-no-jsx-as-prop */
"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { FilePlus2Icon, RadarIcon } from "lucide-react";

import { cn } from "@/lib/utils/twMergeUtils";
import { ROUTES } from "@/constants/route";
import type { ClaimAction } from "@/server/mock/types";

/**
 * Both actions on every row, but never both live — exactly one pill is active, driven entirely
 * by `getClaimAction()`'s single `action` value rather than two independently-derived booleans.
 *
 * A claim that exists but hasn't been submitted yet (still DRAFT) is not "already initiated" —
 * the lender still has work to do on it, so the left pill stays live and reads "Continue Claim"
 * instead of going dark the moment a claim record is created. Everything past that, including a
 * query sent back — which has its own reply-and-reattach composer inside Track Claim, not this
 * workspace — locks the left pill and hands off to the right one, always labelled "Track Claim".
 * Only three labels ever appear here: Initiate Claim, Continue Claim, Track Claim.
 *
 * A DRAFT claim is auto-created the moment the lender opens the workspace, so that alone can't
 * be what "Continue Claim" means — opening the form and going straight back would otherwise
 * relabel a row that's had zero actual work. `hasProgress` (has the lender explicitly clicked
 * Save or Save & Submit) is the real signal; without it a draft still reads "Initiate Claim",
 * even if documents were uploaded along the way — uploading isn't the same as committing to it.
 */
export function ClaimRowActions({
  accountId,
  claimId,
  claimNo,
  action,
  reason,
  hasProgress,
  trackView,
}: Readonly<{
  accountId: string;
  claimId?: string;
  claimNo?: string;
  action: ClaimAction;
  /** Why the initiate side is disabled, e.g. not yet NPA. Ignored when resumable. */
  reason?: string;
  /** Has the lender explicitly saved/submitted this claim at least once? Governs the label only. */
  hasProgress?: boolean;
  /** Whether to open the track claim view as tabs (default) or single page. */
  trackView?: "tabs" | "single";
}>) {
  const initiateActive = action === "INITIATE";
  const resumable = initiateActive && Boolean(claimId) && Boolean(hasProgress);
  const trackActive = action === "TRACK" || action === "VIEW";

  return (
    <div
      role="group"
      aria-label="Claim actions"
      className="flex items-center justify-end gap-1"
    >
      <ActionPill
        active={initiateActive}
        href={ROUTES.initiateClaimWorkspace(accountId)}
        icon={<FilePlus2Icon />}
        label={resumable ? "Continue" : "Initiate"}
        disabledHint={
          reason ??
          (action === "VIEW"
            ? "This claim has already been decided."
            : "This claim has already been submitted to IMGC.")
        }
      />
      <ActionPill
        active={trackActive}
        href={
          trackActive
            ? ROUTES.claimDetails(claimId as string) +
              (trackView === "single" ? "?view=single" : "")
            : "#"
        }
        icon={<RadarIcon />}
        label="Track"
        title={claimNo}
        disabledHint={
          claimId
            ? "Finish the claim on the left before tracking it."
            : "Raise a claim first — there is nothing to track yet."
        }
        variant="outline"
      />
    </div>
  );
}

function ActionPill({
  active,
  href,
  icon,
  label,
  title,
  disabledHint,
  variant = "solid",
}: Readonly<{
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
  title?: string;
  disabledHint: string;
  variant?: "solid" | "outline";
}>) {
  const base =
    "inline-flex h-[26px] items-center gap-0.5 rounded-full px-2 text-[10px] font-semibold whitespace-nowrap transition-all [&_svg]:size-2.5";

  if (!active) {
    return (
      <span
        aria-disabled="true"
        title={disabledHint}
        className={cn(
          base,
          "cursor-not-allowed border border-neutral-200 bg-neutral-50 text-neutral-300"
        )}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={title}
      className={cn(
        base,
        "shadow-sm active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
        variant === "solid"
          ? "bg-brand-primary text-white hover:bg-brand-dark hover:shadow"
          : "border border-brand-primary bg-brand-light/60 text-brand-dark hover:bg-brand-primary hover:text-white"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

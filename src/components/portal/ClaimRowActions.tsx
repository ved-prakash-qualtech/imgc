"use client";

import Link from "next/link";
import { EyeIcon, FilePlus2Icon, RadarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/route";
import type { ClaimAction } from "@/server/mock/types";

/**
 * Exactly one action per row.
 *
 * Which one comes from `getClaimAction()` on the server — this component never re-derives it
 * from `npa`/`writeOff`/status. There is no separate "Raise Query" button: raising a query and
 * tracking a claim are the same screen, so the single button goes there and the query is raised
 * from inside it.
 */
export function ClaimRowActions({
  accountId,
  claimId,
  action,
  reason,
}: Readonly<{
  accountId: string;
  claimId?: string;
  action: ClaimAction;
  /** Why the action is disabled, for the tooltip. */
  reason?: string;
}>) {
  if (action === "INITIATE") {
    return (
      <Button
        size="xs"
        render={<Link href={ROUTES.initiateClaimWorkspace(accountId)} />}
      >
        <FilePlus2Icon />
        {claimId ? "Continue Claim" : "Initiate Claim"}
      </Button>
    );
  }

  if (action === "TRACK" && claimId) {
    return (
      <Button
        size="xs"
        variant="outline"
        render={<Link href={ROUTES.claimDetails(claimId)} />}
      >
        <RadarIcon /> Track Claim
      </Button>
    );
  }

  if (action === "VIEW" && claimId) {
    return (
      <Button
        size="xs"
        variant="outline"
        render={<Link href={ROUTES.claimDetails(claimId)} />}
      >
        <EyeIcon /> Claim Details
      </Button>
    );
  }

  return (
    <Button size="xs" variant="outline" disabled title={reason}>
      <FilePlus2Icon /> Initiate Claim
    </Button>
  );
}

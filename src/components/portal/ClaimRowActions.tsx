"use client";

import Link from "next/link";
import { FilePlus2Icon, RadarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/route";

/**
 * One button per row, and only ever one of two.
 *
 * A row either has a claim or it does not: no claim → Initiate Claim, a claim of any status →
 * Track Claim (that screen carries Continue / Respond / Raise Query inside it). The grid does
 * not branch on claim status.
 */
export function ClaimRowActions({
  accountId,
  claimId,
}: Readonly<{ accountId: string; claimId?: string }>) {
  if (claimId) {
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

  return (
    <Button
      size="xs"
      render={<Link href={ROUTES.initiateClaimWorkspace(accountId)} />}
    >
      <FilePlus2Icon /> Initiate Claim
    </Button>
  );
}

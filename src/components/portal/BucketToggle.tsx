"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRightIcon, InboxIcon } from "lucide-react";
import { toast } from "sonner";

import { shiftBucketAction } from "@/app/[locale]/(portal)/buckets/actions";
import { Button } from "@/components/ui/button";
import type { Bucket } from "@/server/mock/types";

/**
 * BRD: "IMGC team will be able to pull the account in their bucket at any time for processing."
 *
 * The move already existed, but only on the Buckets screen — so taking an account meant leaving
 * the one you were reading, finding its row in a list of twelve, and clicking there. "At any
 * time" means from wherever the decision is actually made, which is the account itself and the
 * pool it is listed in. Same server action either way; this is only the control.
 */
export function BucketToggle({
  accountId,
  loanNo,
  bucket,
  size = "sm",
}: Readonly<{
  accountId: string;
  loanNo: string;
  bucket: Bucket;
  size?: "xs" | "sm";
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const to: Bucket = bucket === "IMGC" ? "LENDER" : "IMGC";
  const pulling = to === "IMGC";

  const onClick = useCallback(() => {
    startTransition(async () => {
      const result = await shiftBucketAction(accountId, to, "");
      if (!result.ok) {
        toast.error(result.error ?? "That move failed.");
        return;
      }
      toast.success(
        pulling
          ? `${loanNo} pulled into the IMGC bucket — stakeholders notified.`
          : `${loanNo} handed back to the lender — stakeholders notified.`
      );
      router.refresh();
    });
  }, [accountId, to, pulling, loanNo, router]);

  return (
    <Button
      size={size}
      variant={pulling ? "default" : "outline"}
      onClick={onClick}
      disabled={pending}
      title={
        pulling
          ? "Take this account into the IMGC bucket for processing"
          : "Hand this account back to the lender for documents"
      }
    >
      {pulling ? <InboxIcon /> : <ArrowLeftRightIcon />}
      {pulling ? "Pull into IMGC" : "Return to lender"}
    </Button>
  );
}

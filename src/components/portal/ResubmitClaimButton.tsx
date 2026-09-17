/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";

import { submitClaimAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Button } from "@/components/ui/button";

export function ResubmitClaimButton({
  accountId,
  claimId,
}: Readonly<{
  accountId: string;
  claimId: string;
}>) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      // Pass empty string or omit __queryResponse since we are not sending chat messages
      const result = await submitClaimAction(accountId, claimId, {});
      if (!result.ok) {
        toast.error(result.error ?? "Failed to resubmit the claim.");
        return;
      }
      toast.success("Claim successfully resubmitted to IMGC for review.");
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      className="bg-brand-primary text-white hover:bg-brand-primary/90"
      onClick={onClick}
      disabled={pending}
    >
      <SendIcon className="mr-2 h-4 w-4" />
      Resubmit Claim
    </Button>
  );
}

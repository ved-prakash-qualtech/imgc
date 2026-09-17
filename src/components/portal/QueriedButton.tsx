/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useTransition } from "react";
import { MessageSquarePlusIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { raiseQueryAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Button } from "@/components/ui/button";

export function QueriedButton({
  claimId,
  claimNo,
}: Readonly<{
  claimId: string;
  claimNo: string;
}>) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      const result = await raiseQueryAction(claimId, {
        reason: "Additional information or documents required",
        remarks: "",
        requestedDocuments: [],
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to mark as Queried.");
        return;
      }
      toast.success(`Claim ${claimNo} marked as Queried.`);
      router.refresh();
    });
  };

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={pending}>
      <MessageSquarePlusIcon className="mr-2 h-4 w-4" />
      Queried
    </Button>
  );
}

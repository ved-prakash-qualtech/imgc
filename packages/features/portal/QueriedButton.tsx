/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useServerErrorMessage } from "@imgc/lib/serverErrorMessage";
import { useTransition } from "react";
import { MessageSquarePlusIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { raiseQueryAction } from "@imgc/actions/initiateClaim";
import { Button } from "@imgc/ui/ui/button";

export function QueriedButton({
  claimId,
  claimNo,
}: Readonly<{
  claimId: string;
  claimNo: string;
}>) {
  const errorText = useServerErrorMessage();
  const t = useTranslations("claim.queried");
  const tFallback = useTranslations("actionFallbacks");
  const tStatus = useTranslations("status");
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
        toast.error(errorText(result) ?? tFallback("queriedFailed"));
        return;
      }
      toast.success(t("success", { claimNo }));
      router.refresh();
    });
  };

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={pending}>
      <MessageSquarePlusIcon className="mr-2 h-4 w-4" />
      {tStatus("QUERIED")}
    </Button>
  );
}

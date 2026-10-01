/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useServerErrorMessage } from "@imgc/lib/serverErrorMessage";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";

import { submitClaimAction } from "@imgc/actions/initiateClaim";
import { Button } from "@imgc/ui/ui/button";

export function ResubmitClaimButton({
  accountId,
  claimId,
}: Readonly<{
  accountId: string;
  claimId: string;
}>) {
  const errorText = useServerErrorMessage();
  const t = useTranslations("claim.resubmit");
  const tFallback = useTranslations("actionFallbacks");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      // Pass empty string or omit __queryResponse since we are not sending chat messages
      const result = await submitClaimAction(accountId, claimId, {});
      if (!result.ok) {
        toast.error(errorText(result) ?? tFallback("resubmitFailed"));
        return;
      }
      toast.success(t("success"));
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
      {t("button")}
    </Button>
  );
}

"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, FilePlus2Icon } from "lucide-react";
import { toast } from "sonner";

import { createClaimAction } from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import { CLAIM_TYPE_KEYS, CLAIM_TYPES } from "@/config/claimConfig";
import { cn } from "@/lib/utils/twMergeUtils";
import type { ClaimTypeKey } from "@/server/mock/types";

/**
 * Choosing the claim type is what creates the claim.
 *
 * The cards are rendered from `CLAIM_TYPES`, so a new claim type appears here — with its own
 * field count and checklist size — without this file changing.
 */
export function ClaimTypeSelectorClient({
  accountId,
  canInitiate,
}: Readonly<{ accountId: string; canInitiate: boolean }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ClaimTypeKey | null>(null);

  const apply = useCallback(() => {
    if (!selected) return;
    startTransition(async () => {
      const result = await createClaimAction(accountId, selected);
      if (!result.ok) {
        toast.error(result.error ?? "That claim could not be started.");
        return;
      }
      toast.success(`${CLAIM_TYPES[selected].label} started.`);
      router.refresh();
    });
  }, [selected, accountId, router]);

  if (!canInitiate) {
    return (
      <Panel title="No claim raised">
        <p className="px-5 py-8 text-center text-[13px] text-neutral-500">
          The lender has not raised a claim on this account yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Select claim type"
      description="The type decides which details and documents are required. It cannot be changed once the claim is started."
    >
      <div className="space-y-5 px-5 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          {CLAIM_TYPE_KEYS.map((key) => {
            const config = CLAIM_TYPES[key];
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(key)}
                className={cn(
                  "flex flex-col items-start rounded-xl border-2 p-4 text-left transition",
                  active
                    ? "border-brand-primary bg-brand-light/40"
                    : "border-neutral-200 hover:border-brand-primary/40 hover:bg-neutral-50"
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold text-neutral-900">
                    {config.label}
                  </span>
                  {active && (
                    <CheckCircle2Icon className="size-4 shrink-0 text-brand-primary" />
                  )}
                </span>
                <span className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
                  {config.description}
                </span>
                <span className="mt-3 text-[11.5px] font-medium text-neutral-400">
                  {config.fields.length} fields ·{" "}
                  {config.documents.filter((d) => d.required).length} mandatory documents
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={apply} disabled={!selected || pending}>
            <FilePlus2Icon />
            {selected ? `Start ${CLAIM_TYPES[selected].label}` : "Apply Claim"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

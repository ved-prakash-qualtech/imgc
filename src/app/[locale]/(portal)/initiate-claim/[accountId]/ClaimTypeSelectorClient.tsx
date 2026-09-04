"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";

export function ClaimTypeSelectorClient({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<
    "INITIAL" | "SETTLEMENT" | "AUCTION" | null
  >(null);

  const handleApply = useCallback(() => {
    if (!selectedType) return;

    if (selectedType === "INITIAL") {
      router.push(`/initiate-claim/${accountId}/initial`);
    }
  }, [selectedType, router, accountId]);

  const selectInitial = useCallback(() => setSelectedType("INITIAL"), []);
  const selectSettlement = useCallback(() => setSelectedType("SETTLEMENT"), []);
  const selectAuction = useCallback(() => setSelectedType("AUCTION"), []);

  return (
    <div className="space-y-4">
      {!selectedType && (
        <div className="flex justify-end">
          <Button
            onClick={selectInitial}
            className="bg-brand-primary text-white hover:bg-brand-primary/90"
          >
            Apply Claim
          </Button>
        </div>
      )}

      {selectedType && (
        <Panel title="Select Claim Type">
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={selectInitial}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                  selectedType === "INITIAL"
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-neutral-200 hover:border-brand-primary/40 hover:bg-neutral-50"
                }`}
              >
                <span className="font-semibold text-neutral-900">
                  Initial Claim
                </span>
                <span className="text-[13px] text-neutral-500 mt-1">
                  Upload required documents and submit the initial claim
                  intimation.
                </span>
              </button>

              <button
                type="button"
                onClick={selectSettlement}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                  selectedType === "SETTLEMENT"
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-neutral-200 hover:border-brand-primary/40 hover:bg-neutral-50"
                }`}
              >
                <span className="font-semibold text-neutral-900">
                  Settlement
                </span>
                <span className="text-[13px] text-neutral-500 mt-1">
                  Propose a settlement or OTS amount for IMGC assessment.
                </span>
              </button>

              <button
                type="button"
                onClick={selectAuction}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                  selectedType === "AUCTION"
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-neutral-200 hover:border-brand-primary/40 hover:bg-neutral-50"
                }`}
              >
                <span className="font-semibold text-neutral-900">Auction</span>
                <span className="text-[13px] text-neutral-500 mt-1">
                  Initiate the auction process and establish reserve pricing.
                </span>
              </button>
            </div>

            {selectedType === "INITIAL" && (
              <div className="flex justify-end pt-4 border-t border-neutral-100">
                <Button
                  onClick={handleApply}
                  className="bg-brand-primary text-white"
                >
                  Continue to Initial Claim
                </Button>
              </div>
            )}

            {selectedType === "SETTLEMENT" && (
              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                <h4 className="font-medium text-neutral-900 text-[14px]">
                  Settlement — Coming Soon
                </h4>
                <p className="text-[13px] text-neutral-600 mt-1">
                  This workflow is planned for a future release and is not
                  available in the current MVP.
                </p>
              </div>
            )}

            {selectedType === "AUCTION" && (
              <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                <h4 className="font-medium text-neutral-900 text-[14px]">
                  Auction — Coming Soon
                </h4>
                <p className="text-[13px] text-neutral-600 mt-1">
                  This workflow is planned for a future release and is not
                  available in the current MVP.
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { addRemarkAction } from "@/app/[locale]/(portal)/accounts/[accountId]/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/twMergeUtils";
import type { Remark } from "@/server/mock/types";

/** BRD: a trail of the remarks and feedback captured from the lender and from IMGC. */
export function RemarksTab({
  accountId,
  remarks,
  documentNames,
}: Readonly<{
  accountId: string;
  remarks: Remark[];
  documentNames: Record<string, string>;
}>) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      startTransition(async () => {
        const result = await addRemarkAction(accountId, body);
        if (!result.ok) {
          toast.error(result.error ?? "That remark could not be added.");
          return;
        }
        setBody("");
        toast.success("Remark added.");
        router.refresh();
      });
    },
    [accountId, body, router]
  );

  return (
    <Panel
      title="Remarks & feedback"
      description="Everything said on this account, by either side, newest first."
    >
      <form onSubmit={onSubmit} className="border-b border-neutral-100 px-5 py-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a remark for the other side to see…"
          aria-label="New remark"
          className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-[13px] outline-none placeholder:text-neutral-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            <SendIcon /> Add remark
          </Button>
        </div>
      </form>

      {remarks.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-500">
          No remarks yet.
        </p>
      ) : (
        <ol className="divide-y divide-neutral-100">
          {remarks.map((r) => (
            <li key={r.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-neutral-950">
                  {r.authorName}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                    r.authorRole === "IMGC"
                      ? "bg-brand-muted text-brand-dark"
                      : "bg-warning/15 text-warning"
                  )}
                >
                  {r.authorRole}
                </span>
                {r.documentId && documentNames[r.documentId] && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-medium text-neutral-600">
                    on {documentNames[r.documentId]}
                  </span>
                )}
                <span className="text-[11.5px] text-neutral-400">
                  {new Date(r.createdAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
                {r.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

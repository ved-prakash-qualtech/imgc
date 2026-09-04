"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { updatePasValueAction } from "@/app/[locale]/(portal)/accounts/[accountId]/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PasValue } from "@/server/mock/types";

/**
 * BRD: the portal pulls accounting values from PAS and can write them back. Editing here is a
 * write *to PAS* — the portal holds no second copy of the number.
 */
export function AccountingValuesTab({
  accountId,
  values,
}: Readonly<{ accountId: string; values: PasValue[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const onPull = useCallback(() => {
    startTransition(() => {
      router.refresh();
      toast.success("Pulled the latest values from PAS.");
    });
  }, [router]);

  const beginEdit = useCallback((value: PasValue) => {
    setEditing(value.key);
    setDraft(value.value);
  }, []);

  const onSave = useCallback(
    (key: string) => {
      startTransition(async () => {
        const result = await updatePasValueAction(accountId, key, draft);
        if (!result.ok) {
          toast.error(result.error ?? "PAS rejected that update.");
          return;
        }
        toast.success("Updated in PAS.");
        setEditing(null);
        router.refresh();
      });
    },
    [accountId, draft, router]
  );

  return (
    <Panel
      title="Accounting values"
      description="Read from PAS. An edit here is written back to PAS and recorded in the audit trail."
      actions={
        <Button size="sm" variant="outline" onClick={onPull} disabled={pending}>
          <RefreshCwIcon /> Pull from PAS
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {values.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  PAS returned no values for this account.
                </TableCell>
              </TableRow>
            ) : (
              values.map((v) => (
                <TableRow key={v.key}>
                  <TableCell className="font-medium text-neutral-950">
                    {v.label}
                  </TableCell>
                  <TableCell>
                    {editing === v.key ? (
                      <input
                        // Replaces the cell the user just clicked Edit on, so focus follows
                        // the action they took rather than being seized on load.
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label={`New value for ${v.label}`}
                        className="h-9 w-[200px] rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      />
                    ) : (
                      <span className="tabular-nums">{v.value}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-neutral-600">
                      {v.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-500">
                    {new Date(v.updatedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {v.updatedBy}
                  </TableCell>
                  <TableCell className="text-right">
                    {editing === v.key ? (
                      <span className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          onClick={() => onSave(v.key)}
                          disabled={pending}
                        >
                          Update in PAS
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => beginEdit(v)}
                        disabled={pending}
                      >
                        <PencilIcon /> Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

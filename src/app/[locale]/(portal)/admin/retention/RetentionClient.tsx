"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrushCleaningIcon } from "lucide-react";
import { toast } from "sonner";

import {
  decideReinstateAction,
  runSweepAction,
} from "@/app/[locale]/(portal)/admin/retention/actions";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RejectedDocRow } from "@/services/portal/retention.server";

export function RetentionClient({
  rows,
  retentionDays,
}: Readonly<{ rows: RejectedDocRow[]; retentionDays: number }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onSweep = useCallback(() => {
    startTransition(async () => {
      const result = await runSweepAction();
      if (!result.ok) {
        toast.error(result.error ?? "The sweep failed.");
        return;
      }
      toast.success(
        result.purged
          ? `${result.purged} document(s) purged.`
          : "Nothing has aged out — everything is still inside the window."
      );
      router.refresh();
    });
  }, [router]);

  const onDecide = useCallback(
    (row: RejectedDocRow, approve: boolean) => {
      startTransition(async () => {
        const result = await decideReinstateAction(
          row.accountId,
          row.id,
          approve,
          ""
        );
        if (!result.ok) {
          toast.error(result.error ?? "That decision could not be recorded.");
          return;
        }
        toast.success(approve ? "Document reinstated." : "Reinstatement denied.");
        router.refresh();
      });
    },
    [router]
  );

  return (
    <Panel
      title={`${rows.length} rejected document${rows.length === 1 ? "" : "s"}`}
      description={`Rejected documents are kept for ${retentionDays} days, then purged — unless a reinstatement is requested, which holds them.`}
      actions={
        <Button size="sm" variant="outline" onClick={onSweep} disabled={pending}>
          <BrushCleaningIcon /> Run sweep
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-500">
          Nothing is currently rejected.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead className="text-right">Reinstatement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-neutral-950">
                    {row.name}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={ROUTES.account(row.accountId)}
                      className="text-brand-primary hover:underline"
                    >
                      {row.accountLoanNo}
                    </Link>
                    <span className="block text-[12px] text-neutral-500">
                      {row.borrowerName}
                    </span>
                  </TableCell>
                  <TableCell className="text-neutral-600">
                    {row.lenderOrgName}
                  </TableCell>
                  <TableCell className="max-w-[260px] text-[12.5px] text-neutral-600">
                    {row.rejection.reason}
                    <span className="block text-[11.5px] text-neutral-400">
                      by {row.rejection.by} ·{" "}
                      {new Date(row.rejection.at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.held ? (
                      <span className="text-[12.5px] font-medium text-warning">
                        Held
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "text-[12.5px] font-medium tabular-nums",
                          row.daysLeft <= 14 ? "text-destructive" : "text-neutral-600"
                        )}
                      >
                        {Math.max(0, row.daysLeft)} days left
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.rejection.reinstate?.status === "REQUESTED" ? (
                      <span className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          variant="success"
                          onClick={() => onDecide(row, true)}
                          disabled={pending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => onDecide(row, false)}
                          disabled={pending}
                        >
                          Deny
                        </Button>
                      </span>
                    ) : row.rejection.reinstate ? (
                      <StatusPill status={row.rejection.reinstate.status} />
                    ) : (
                      <span className="text-[12.5px] text-neutral-400">
                        Not requested
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

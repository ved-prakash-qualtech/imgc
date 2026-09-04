"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRightIcon, MailPlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  setPushRecipientsAction,
  shiftBucketAction,
} from "@/app/[locale]/(portal)/buckets/actions";
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
import type { AccountRow } from "@/services/portal/accounts.server";

export function BucketsClient({
  accounts,
}: Readonly<{ accounts: AccountRow[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [recipients, setRecipients] = useState("");

  const onShift = useCallback(
    (account: AccountRow) => {
      const to = account.bucket === "IMGC" ? "LENDER" : "IMGC";
      startTransition(async () => {
        const result = await shiftBucketAction(account.id, to, "");
        if (!result.ok) {
          toast.error(result.error ?? "That move failed.");
          return;
        }
        toast.success(
          `${account.loanNo} moved to the ${to} bucket — stakeholders notified.`
        );
        router.refresh();
      });
    },
    [router]
  );

  const onSaveRecipients = useCallback(
    (accountId: string) => {
      startTransition(async () => {
        const result = await setPushRecipientsAction(accountId, recipients);
        if (!result.ok) {
          toast.error(result.error ?? "Those recipients could not be saved.");
          return;
        }
        toast.success("Notification recipients updated.");
        setEditing(null);
        router.refresh();
      });
    },
    [recipients, router]
  );

  return (
    <Panel
      title="Processing buckets"
      description="Moving an account emails the lender's stakeholders, every IMGC mailbox, and any extra recipients pinned to the account."
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan no.</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Lender</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Claim</TableHead>
              <TableHead>Extra recipients</TableHead>
              <TableHead className="text-right">Move</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-neutral-950">
                  <Link
                    href={ROUTES.account(a.id)}
                    className="hover:text-brand-primary hover:underline"
                  >
                    {a.loanNo}
                  </Link>
                </TableCell>
                <TableCell>{a.borrowerName}</TableCell>
                <TableCell className="text-neutral-500">{a.lenderOrgName}</TableCell>
                <TableCell>
                  <StatusPill status={a.bucket} />
                </TableCell>
                <TableCell>
                  <StatusPill status={a.claimStatus} />
                </TableCell>
                <TableCell>
                  {editing === a.id ? (
                    <span className="flex items-center gap-1.5">
                      <input
                        // Replaces the cell the user just clicked to edit, so focus follows
                        // the action they took.
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        placeholder="a@x.com, b@y.com"
                        aria-label="Extra notification recipients"
                        className="h-8 w-[220px] rounded-lg border border-neutral-200 px-2.5 text-[12.5px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                      />
                      <Button
                        size="xs"
                        onClick={() => onSaveRecipients(a.id)}
                        disabled={pending}
                      >
                        Save
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
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(a.id);
                        setRecipients(a.pushRecipients.join(", "));
                      }}
                      className="inline-flex items-center gap-1.5 text-[12.5px] text-neutral-600 hover:text-brand-primary"
                    >
                      <MailPlusIcon className="size-3.5" />
                      {a.pushRecipients.length > 0
                        ? a.pushRecipients.join(", ")
                        : "Add"}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => onShift(a)}
                    disabled={pending}
                  >
                    <ArrowLeftRightIcon />
                    To {a.bucket === "IMGC" ? "Lender" : "IMGC"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

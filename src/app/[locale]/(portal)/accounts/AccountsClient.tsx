"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
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
import type { AccountRow } from "@/services/portal/accounts.server";
import type { Role } from "@/server/mock/types";

const BUCKETS = ["ALL", "IMGC", "LENDER"] as const;
const STATUSES = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "QUERIED"] as const;

export function AccountsClient({
  accounts,
  role,
}: Readonly<{ accounts: AccountRow[]; role: Role }>) {
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (bucket !== "ALL" && a.bucket !== bucket) return false;
      if (status !== "ALL" && a.claimStatus !== status) return false;
      if (!q) return true;
      return (
        a.loanNo.toLowerCase().includes(q) ||
        a.borrowerName.toLowerCase().includes(q) ||
        a.lenderOrgName.toLowerCase().includes(q)
      );
    });
  }, [accounts, query, bucket, status]);

  return (
    <Panel
      title={`${rows.length} account${rows.length === 1 ? "" : "s"}`}
      description={
        role === "IMGC"
          ? "The complete pool across every lender."
          : "Accounts belonging to your organisation."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Loan no, borrower, lender"
              aria-label="Search accounts"
              className="h-9 w-[230px] rounded-lg border border-neutral-200 pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <FilterGroup
            label="Bucket"
            options={BUCKETS}
            value={bucket}
            onChange={setBucket}
          />
          <FilterGroup
            label="Status"
            options={STATUSES}
            value={status}
            onChange={setStatus}
          />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan no.</TableHead>
              <TableHead>Borrower</TableHead>
              {role === "IMGC" && <TableHead>Lender</TableHead>}
              <TableHead>Product</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Claim</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={role === "IMGC" ? 8 : 7}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No accounts match those filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-neutral-950">
                    {a.loanNo}
                  </TableCell>
                  <TableCell>{a.borrowerName}</TableCell>
                  {role === "IMGC" && <TableCell>{a.lenderOrgName}</TableCell>}
                  <TableCell className="text-neutral-500">{a.product}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-[12.5px] font-medium",
                        a.pendingDocs > 0 ? "text-warning" : "text-success-700"
                      )}
                    >
                      {a.requiredDocs - a.pendingDocs}/{a.requiredDocs} in
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={a.bucket} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={a.claimStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={ROUTES.account(a.id)}
                      className="text-[13px] font-semibold text-brand-primary hover:underline"
                    >
                      Open
                    </Link>
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

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: Readonly<{
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}>) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-neutral-200 p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[12px] font-medium capitalize transition-colors",
            value === option
              ? "bg-brand-primary text-white"
              : "text-neutral-600 hover:bg-neutral-50"
          )}
        >
          {option === "ALL" ? label : option.toLowerCase()}
        </button>
      ))}
    </div>
  );
}

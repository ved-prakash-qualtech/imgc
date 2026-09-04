"use client";

import { useCallback, useMemo, useState } from "react";
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
import type { AccountRow } from "@/services/portal/accounts.server";

export function TrackCasesClient({
  accounts,
}: Readonly<{ accounts: AccountRow[] }>) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (!q) return true;
      return (
        a.loanNo.toLowerCase().includes(q) ||
        a.borrowerName.toLowerCase().includes(q)
      );
    });
  }, [accounts, query]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    []
  );

  const renderActions = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={handleQueryChange}
          placeholder="Loan no, borrower"
          aria-label="Search cases"
          className="h-9 w-[230px] rounded-lg border border-neutral-200 pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>
    </div>
  );

  return (
    <Panel
      title={`${rows.length} tracked claim${rows.length === 1 ? "" : "s"}`}
      description="View case details and respond to queries."
      actions={renderActions()}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan no.</TableHead>
              <TableHead>Borrower</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Current Stage</TableHead>
              <TableHead>Claim Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No submitted or processed claims found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-neutral-950">
                    {a.loanNo}
                  </TableCell>
                  <TableCell>{a.borrowerName}</TableCell>
                  <TableCell className="text-neutral-500">
                    {a.product}
                  </TableCell>
                  <TableCell>
                    <span className="text-neutral-600">{a.stage}</span>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={a.claimStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={ROUTES.trackQueryWorkspace(a.id)}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      View Case
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

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Panel } from "@/components/portal/Panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/route";
import type { AuditEvent } from "@/server/mock/types";

type AccountSummary = {
  loanNo: string;
  borrowerName: string;
};

export function AuditTrailClient({
  events,
  accountMap,
}: Readonly<{
  events: AuditEvent[];
  accountMap: Record<string, AccountSummary>;
}>) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (!q) return true;
      const account = accountMap[e.accountId];
      return (
        e.summary.toLowerCase().includes(q) ||
        (account?.loanNo || "").toLowerCase().includes(q) ||
        (account?.borrowerName || "").toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q)
      );
    });
  }, [events, query, accountMap]);

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
          placeholder="Search activity..."
          aria-label="Search activity"
          className="h-9 w-[230px] rounded-lg border border-neutral-200 pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>
    </div>
  );

  return (
    <Panel title="Activity history" actions={renderActions()}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No audit activity found for your accessible cases.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => {
                const account = accountMap[e.accountId];
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-[12.5px] text-neutral-500">
                      {new Date(e.at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {account ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-900">
                            {account.loanNo}
                          </span>
                          <span className="text-[12px] text-neutral-500">
                            {account.borrowerName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900">
                          {e.type}
                        </span>
                        <span className="text-[12.5px] text-neutral-600">
                          {e.summary}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900">
                          {e.actorName}
                        </span>
                        <span className="text-[12px] text-neutral-500">
                          {e.actorRole}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={ROUTES.trackQueryWorkspace(e.accountId)}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                      >
                        View Case
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

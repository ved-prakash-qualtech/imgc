"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  SearchIcon,
} from "lucide-react";

import { ClaimRowActions } from "@/components/portal/ClaimRowActions";
import { Panel } from "@/components/portal/Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationNumbers } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EligibleRow } from "@/app/[locale]/(portal)/initiate-claim/page";

type SortKey = "loanNo" | "borrowerName" | "product" | "npa" | "stage";
type SortDirection = "asc" | "desc" | null;

const SortIcon = ({
  column,
  sortKey,
  sortDirection,
}: {
  column: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
}) => {
  if (sortKey !== column)
    return <ArrowUpDownIcon className="ml-1 size-3.5 text-neutral-400" />;
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-1 size-3.5 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-1 size-3.5 text-neutral-800" />
  );
};

const SortableTableHead = ({
  column,
  label,
  sortKey,
  sortDirection,
  onToggle,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onToggle: (k: SortKey) => void;
}) => {
  const handleClick = useCallback(() => onToggle(column), [column, onToggle]);
  return (
    <TableHead
      onClick={handleClick}
      className="cursor-pointer select-none hover:bg-neutral-50 transition-colors"
    >
      <div className="flex items-center">
        {label}{" "}
        <SortIcon
          column={column}
          sortKey={sortKey}
          sortDirection={sortDirection}
        />
      </div>
    </TableHead>
  );
};

export function EligibleCasesClient({
  accounts,
}: Readonly<{ accounts: EligibleRow[] }>) {
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [npaFilter, setNpaFilter] = useState("all");

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      setSortDirection((prevDir) => {
        if (prevKey === key) {
          if (prevDir === "asc") return "desc";
          if (prevDir === "desc") {
            setSortKey(null);
            return null;
          }
        }
        return "asc";
      });
      return key;
    });
  }, []);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setPage(1);
    },
    []
  );

  const handleNpaFilterChange = useCallback((val: string | null) => {
    setNpaFilter(val ?? "all");
    setPage(1);
  }, []);

  const handleProductFilterChange = useCallback((val: string | null) => {
    setProductFilter(val ?? "all");
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "5"));
    setPage(1);
  }, []);

  const filteredAndSortedRows = useMemo(() => {
    // This grid is NPA-only by design.
    let result = accounts.filter((a) => a.npa);

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.loanNo.toLowerCase().includes(q) ||
          a.borrowerName.toLowerCase().includes(q)
      );
    }

    if (productFilter !== "all") {
      result = result.filter((a) => a.product === productFilter);
    }
    if (npaFilter !== "all") {
      result = result.filter((a) => (npaFilter === "yes" ? a.npa : !a.npa));
    }

    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | boolean;
        let valB: string | boolean;
        switch (sortKey) {
          case "loanNo":
            valA = a.loanNo;
            valB = b.loanNo;
            break;
          case "borrowerName":
            valA = a.borrowerName;
            valB = b.borrowerName;
            break;
          case "product":
            valA = a.product;
            valB = b.product;
            break;
          case "npa":
            valA = a.npa;
            valB = b.npa;
            break;
          case "stage":
            valA = a.stage;
            valB = b.stage;
            break;
          default:
            valA = "";
            valB = "";
        }

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [
    accounts,
    query,
    productFilter,
    npaFilter,
    sortKey,
    sortDirection,
  ]);

  const pageCount = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const currentRows = filteredAndSortedRows.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const products = Array.from(new Set(accounts.map((a) => a.product)));

  return (
    <Panel
      title={`${filteredAndSortedRows.length} eligible case${filteredAndSortedRows.length === 1 ? "" : "s"}`}
      description="Accounts tagged as NPA."
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 p-4 pb-0">
        <div className="flex flex-wrap items-center gap-3 pb-4">
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

          <Select value={npaFilter} onValueChange={handleNpaFilterChange}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="NPA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">NPA: All</SelectItem>
              <SelectItem value="yes">NPA: YES</SelectItem>
              <SelectItem value="no">NPA: NO</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={productFilter}
            onValueChange={handleProductFilterChange}
          >
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Product: All</SelectItem>
              {products.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="loanNo"
                label="Loan no."
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="borrowerName"
                label="Borrower"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="product"
                label="Product"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="npa"
                label="NPA Status"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <SortableTableHead
                column="stage"
                label="Current Stage"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onToggle={toggleSort}
              />
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-[13px] text-neutral-500"
                >
                  No eligible NPA cases match your filters.
                </TableCell>
              </TableRow>
            ) : (
              currentRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-neutral-950">
                    {a.loanNo}
                  </TableCell>
                  <TableCell>{a.borrowerName}</TableCell>
                  <TableCell className="text-neutral-500">
                    {a.product}
                  </TableCell>
                  <TableCell>
                    {a.npa ? (
                      <span className="text-amber-600 font-semibold">YES</span>
                    ) : (
                      "NO"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-neutral-600">{a.stage}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ClaimRowActions
                      accountId={a.id}
                      claimId={a.claim?.id}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-25 px-5 py-3">
        <div className="flex items-center gap-3 text-[13px] text-neutral-500">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger size="sm" className="w-[70px] h-8 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="hidden sm:inline">
            Total {filteredAndSortedRows.length} case
            {filteredAndSortedRows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[13px] text-neutral-500 hidden sm:inline">
            Page {page} of {pageCount}
          </span>
          <PaginationNumbers
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </div>
      </div>
    </Panel>
  );
}

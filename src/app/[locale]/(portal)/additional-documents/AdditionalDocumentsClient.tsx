"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  BanIcon,
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addRequirementAction,
  setActiveAction,
  updateRequirementAction,
} from "@/app/[locale]/(portal)/additional-documents/actions";
import {
  AddRequirementForm,
  type CaseOption,
} from "@/components/portal/AddRequirementForm";
import { Panel } from "@/components/portal/Panel";
import { ReviewDrawer } from "@/components/portal/ReviewDrawer";
import { StatusPill } from "@/components/portal/StatusPill";
import { Button } from "@/components/ui/button";
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
import { ROUTES } from "@/constants/route";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementInput } from "@/services/portal/claims.server";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { DocStatus } from "@/server/mock/types";

const STATUSES: ReadonlyArray<DocStatus> = [
  "NOT_REQUESTED",
  "PENDING_UPLOAD",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REUPLOAD_REQUIRED",
];

const STATUS_LABEL: Record<DocStatus, string> = {
  NOT_REQUESTED: "Not requested",
  PENDING_UPLOAD: "Pending upload",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REUPLOAD_REQUIRED: "Reupload req.",
};

type SortKey = "caseId" | "customerName" | "documentName" | "required" | "status" | "lenderName" | "addedByName" | "addedOn";
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
    return <ArrowUpDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-400" />;
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  );
};

const SortableTableHead = ({
  column,
  label,
  sortKey,
  sortDirection,
  onToggle,
  className,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onToggle: (k: SortKey) => void;
  className?: string;
}) => (
  <TableHead
    onClick={() => onToggle(column)}
    className={cn(
      "h-8 cursor-pointer select-none px-1.5 text-[10.5px] transition-colors hover:bg-neutral-50",
      className
    )}
  >
    <div className="flex items-center">
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
    </div>
  </TableHead>
);

function shortDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

/** Escapes a value for one CSV field. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: RequirementRow[]): void {
  const headers = [
    "Case ID",
    "Customer",
    "Document",
    "Required",
    "Status",
    "Lender",
    "Added By",
    "Added On",
  ];
  const lines = rows.map((r) =>
    [
      r.caseId,
      r.customerName,
      r.name,
      r.required ? "Required" : "Optional",
      r.active ? r.status : "DEACTIVATED",
      r.lenderName,
      r.addedByName,
      r.addedOn.slice(0, 10),
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `additional-documents-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** A single filter dropdown — collapses what used to be a row of pills per dimension into one
 *  compact control, matching the filter style every other table in the portal uses. */
function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  render,
}: Readonly<{
  label: string;
  allLabel: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  render?: (v: string) => string;
}>) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {render?.(option) ?? option}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}

/**
 * IMGC's cross-case workbench for additional documents.
 *
 * Everything is filtered client-side over rows the server already scoped, which keeps every
 * control instant. The rows themselves are the same records the lender's page and the account
 * workspace read, so a decision taken in the drawer here shows up in all three.
 */
export function AdditionalDocumentsClient({
  rows,
  cases,
}: Readonly<{ rows: RequirementRow[]; cases: CaseOption[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [caseId, setCaseId] = useState("");
  const [lender, setLender] = useState("");
  const [product, setProduct] = useState("");
  const [document, setDocument] = useState("");
  const [status, setStatus] = useState("");
  const [necessity, setNecessity] = useState("");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDirection("asc");
        return;
      }
      if (sortDirection === "asc") {
        setSortDirection("desc");
        return;
      }
      setSortKey(null);
      setSortDirection(null);
    },
    [sortKey, sortDirection]
  );

  const [adding, setAdding] = useState(false);
  const [addCaseId, setAddCaseId] = useState("");
  const [editing, setEditing] = useState<RequirementRow | null>(null);
  const [reviewing, setReviewing] = useState<RequirementRow | null>(null);

  const options = useMemo(
    () => ({
      cases: [...new Set(rows.map((r) => r.caseId))].sort(),
      lenders: [...new Set(rows.map((r) => r.lenderName))].sort(),
      products: [...new Set(rows.map((r) => r.product))].sort(),
      documents: [...new Set(rows.map((r) => r.name))].sort(),
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = rows.filter((r) => {
      if (q) {
        const hay =
          `${r.caseId} ${r.customerName} ${r.name} ${r.lenderName} ${r.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (caseId && r.caseId !== caseId) return false;
      if (lender && r.lenderName !== lender) return false;
      if (product && r.product !== product) return false;
      if (document && r.name !== document) return false;
      if (status && r.status !== status) return false;
      if (necessity === "REQUIRED" && !r.required) return false;
      if (necessity === "OPTIONAL" && r.required) return false;
      if (from && Date.parse(r.addedOn) < Date.parse(from)) return false;
      return true;
    });
    
    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | number = "";
        let valB: string | number = "";
        switch (sortKey) {
          case "caseId": valA = a.caseId; valB = b.caseId; break;
          case "customerName": valA = a.customerName; valB = b.customerName; break;
          case "documentName": valA = a.name; valB = b.name; break;
          case "required": valA = a.required ? 1 : 0; valB = b.required ? 1 : 0; break;
          case "status": valA = a.active ? a.status : "DEACTIVATED"; valB = b.active ? b.status : "DEACTIVATED"; break;
          case "lenderName": valA = a.lenderName; valB = b.lenderName; break;
          case "addedByName": valA = a.addedByName; valB = b.addedByName; break;
          case "addedOn": valA = a.addedOn; valB = b.addedOn; break;
        }
        if (typeof valA === "string" && typeof valB === "string") {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rows, query, caseId, lender, product, document, status, necessity, from, sortKey, sortDirection]);

  const anyFilter =
    Boolean(query || caseId || lender || product || document || status || necessity || from);

  const clearFilters = useCallback(() => {
    setQuery("");
    setCaseId("");
    setLender("");
    setProduct("");
    setDocument("");
    setStatus("");
    setNecessity("");
    setFrom("");
    setPage(1);
  }, []);

  const pageCount = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "10"));
    setPage(1);
  }, []);
  const handleExport = useCallback(() => downloadCsv(filtered), [filtered]);

  const onAdd = useCallback(
    async (input: RequirementInput) => {
      const result = await addRequirementAction(addCaseId, input);
      if (result.ok) {
        setAddCaseId("");
        router.refresh();
      }
      return result;
    },
    [addCaseId, router]
  );

  const onEdit = useCallback(
    async (input: RequirementInput) => {
      if (!editing) return { ok: false, error: "Nothing selected." };
      const result = await updateRequirementAction(editing.accountId, editing.id, input);
      if (result.ok) router.refresh();
      return result;
    },
    [editing, router]
  );

  const onToggle = useCallback(
    (row: RequirementRow) => {
      startTransition(async () => {
        const result = await setActiveAction(row.accountId, row.id, !row.active);
        if (!result.ok) {
          toast.error(result.error ?? "That change failed.");
          return;
        }
        toast.success(
          row.active
            ? `"${row.name}" deactivated — the lender no longer sees it.`
            : `"${row.name}" reactivated.`
        );
        router.refresh();
      });
    },
    [router]
  );

  return (
    <>
      <Panel
        title={`${filtered.length} requirement${filtered.length === 1 ? "" : "s"}`}
        description="Every additional document IMGC has asked a lender for, across all cases."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <DownloadIcon /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setAdding((v) => !v);
              }}
            >
              <PlusIcon /> Add Document Requirement
            </Button>
          </div>
        }
      >
        {adding && (
          <AddRequirementForm
            accountProduct=""
            cases={cases}
            selectedCaseId={addCaseId}
            onCaseChange={setAddCaseId}
            onSubmit={onAdd}
            onCancel={() => setAdding(false)}
          />
        )}
        {editing && (
          <AddRequirementForm
            accountProduct={editing.product}
            submitLabel="Save changes"
            initial={{
              name: editing.name,
              category: editing.category,
              description: editing.description,
              required: editing.required,
              applicableProduct: editing.product,
              applicableCaseType: "Initial Claim",
              dueDate: editing.dueDate ?? "",
              remarks: editing.requirementRemarks ?? "",
              active: editing.active,
              priority: editing.priority as RequirementInput["priority"],
            }}
            onSubmit={onEdit}
            onCancel={() => setEditing(null)}
          />
        )}

        {/* ── Search + filters — six dimensions, one compact row of dropdowns instead of
             six rows of pills, matching every other table in the portal. ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Case, customer, document, lender…"
              aria-label="Search requirements"
              className="h-8 w-[240px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <FilterSelect
            label="Status"
            allLabel="Document Status"
            options={STATUSES}
            value={status}
            onChange={setStatus}
            render={(s) => s.replace(/_/g, " ").toLowerCase()}
          />
          <FilterSelect
            label="Required"
            allLabel="Required or optional"
            options={["REQUIRED", "OPTIONAL"]}
            value={necessity}
            onChange={setNecessity}
            render={(v) => (v === "REQUIRED" ? "Required" : "Optional")}
          />
          <FilterSelect
            label="Case"
            allLabel="All cases"
            options={options.cases}
            value={caseId}
            onChange={setCaseId}
          />
          <FilterSelect
            label="Lender"
            allLabel="All lenders"
            options={options.lenders}
            value={lender}
            onChange={setLender}
          />
          <FilterSelect
            label="Product"
            allLabel="All products"
            options={options.products}
            value={product}
            onChange={setProduct}
          />
          <FilterSelect
            label="Document"
            allLabel="All documents"
            options={options.documents}
            value={document}
            onChange={setDocument}
          />
          <label className="flex items-center gap-1.5 text-[11.5px] text-neutral-500">
            Added from
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 rounded-full border border-neutral-200 px-2.5 text-[12.5px] outline-none focus:border-brand-primary"
            />
          </label>
          {anyFilter && (
            <Button size="xs" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="caseId" label="Case ID" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="customerName" label="Customer" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="documentName" label="Document" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="required" label="Required" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="status" label="Status" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="lenderName" label="Lender" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="addedByName" label="Added by" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="addedOn" label="Added on" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <TableHead className="h-8 px-1.5 text-right text-[10.5px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-14 text-center">
                    <SearchXIcon className="mx-auto mb-2 size-6 text-neutral-300" />
                    <p className="text-[13px] font-medium text-neutral-700">
                      No requirements match those filters.
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-neutral-500">
                      {anyFilter
                        ? "Try widening the search, or clear the filters."
                        : "Add a document requirement to get started."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                currentRows.map((r) => (
                  <TableRow key={r.id} className={cn(!r.active && "opacity-55")}>
                    <TableCell className="px-1.5 py-1.5">
                      <Link
                        href={ROUTES.account(r.accountId)}
                        className="inline-flex items-center rounded-full bg-info/12 px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-info hover:underline"
                      >
                        {r.caseId}
                      </Link>
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap">
                      {r.customerName}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      <span className="text-[12px] font-medium whitespace-nowrap text-neutral-900">
                        {r.name}
                      </span>
                      <span className="block text-[10.5px] whitespace-nowrap text-neutral-500">
                        {r.category}
                        {r.version > 0 && ` · v${r.version}`}
                      </span>
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[9.5px] font-semibold whitespace-nowrap uppercase tracking-wide",
                          r.required
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-neutral-50 text-neutral-400"
                        )}
                      >
                        {r.required ? "Required" : "Optional"}
                      </span>
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      {r.active ? (
                        <StatusPill status={r.status} className="px-1.5 py-0.5 text-[10.5px]" />
                      ) : (
                        <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-neutral-600">
                          Deactivated
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-500">
                      {r.lenderName}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-500">
                      {r.addedByName}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-500">
                      {shortDate(r.addedOn)}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setReviewing(r)}
                          title={r.file ? "Review the uploaded document" : "View the requirement"}
                        >
                          <EyeIcon />
                          {r.file ? "Review" : "View"}
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setAdding(false);
                            setEditing(r);
                          }}
                          title="Edit this requirement"
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => onToggle(r)}
                          disabled={pending}
                          title={r.active ? "Deactivate" : "Reactivate"}
                        >
                          {r.active ? <BanIcon /> : <RotateCcwIcon />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-25 px-5 py-2">
          <div className="flex items-center gap-3 text-[13px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger size="sm" className="h-8 w-[70px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="hidden sm:inline">
              Total {filtered.length} requirement{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] text-neutral-500 sm:inline">
              Page {currentPage} of {pageCount}
            </span>
            <PaginationNumbers
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </div>
        </div>
      </Panel>

      <ReviewDrawer
        row={reviewing}
        open={reviewing !== null}
        onOpenChange={(next) => !next && setReviewing(null)}
      />
    </>
  );
}

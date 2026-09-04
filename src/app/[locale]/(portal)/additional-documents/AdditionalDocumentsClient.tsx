"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BanIcon,
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

function shortDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

/** A single filter control — a row of pills, so the active value is always visible. */
function FilterPills({
  label,
  options,
  value,
  onChange,
  render,
}: Readonly<{
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  render?: (v: string) => string;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {["", ...options].map((option) => (
        <button
          key={option || "all"}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition",
            value === option
              ? "bg-brand-primary text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          )}
        >
          {option === "" ? "All" : (render?.(option) ?? option)}
        </button>
      ))}
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
    return rows.filter((r) => {
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
  }, [rows, query, caseId, lender, product, document, status, necessity, from]);

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
  }, []);

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
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setAdding((v) => !v);
            }}
          >
            <PlusIcon /> Add Document Requirement
          </Button>
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

        {/* ── Search + filters ─────────────────────────────────── */}
        <div className="space-y-2.5 border-b border-neutral-100 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Case, customer, document, lender…"
                aria-label="Search requirements"
                className="h-8 w-[280px] rounded-lg border border-neutral-200 pl-8 pr-2.5 text-[12.5px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </span>
            <label className="flex items-center gap-1.5 text-[11.5px] text-neutral-500">
              Added from
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 rounded-lg border border-neutral-200 px-2 text-[12.5px] outline-none focus:border-brand-primary"
              />
            </label>
            {anyFilter && (
              <Button size="xs" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          <FilterPills label="Status" options={STATUSES} value={status} onChange={setStatus} render={(s) => s.replace(/_/g, " ").toLowerCase()} />
          <FilterPills label="Required" options={["REQUIRED", "OPTIONAL"]} value={necessity} onChange={setNecessity} render={(v) => (v === "REQUIRED" ? "Required" : "Optional")} />
          <FilterPills label="Case" options={options.cases} value={caseId} onChange={setCaseId} />
          <FilterPills label="Lender" options={options.lenders} value={lender} onChange={setLender} />
          <FilterPills label="Product" options={options.products} value={product} onChange={setProduct} />
          <FilterPills label="Document" options={options.documents} value={document} onChange={setDocument} />
        </div>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead>Added on</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
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
                filtered.map((r) => (
                  <TableRow key={r.id} className={cn(!r.active && "opacity-55")}>
                    <TableCell className="font-medium text-neutral-950">
                      <Link
                        href={ROUTES.account(r.accountId)}
                        className="hover:text-brand-primary hover:underline"
                      >
                        {r.caseId}
                      </Link>
                    </TableCell>
                    <TableCell>{r.customerName}</TableCell>
                    <TableCell>
                      <span className="font-medium text-neutral-900">{r.name}</span>
                      <span className="block text-[11.5px] text-neutral-500">
                        {r.category}
                        {r.version > 0 && ` · v${r.version}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                          r.required
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-neutral-50 text-neutral-400"
                        )}
                      >
                        {r.required ? "Required" : "Optional"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.active ? (
                        <StatusPill status={r.status} />
                      ) : (
                        <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[11.5px] font-semibold text-neutral-600">
                          Deactivated
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-500">{r.lenderName}</TableCell>
                    <TableCell className="text-neutral-500">{r.addedByName}</TableCell>
                    <TableCell className="text-neutral-500">{shortDate(r.addedOn)}</TableCell>
                    <TableCell>
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
      </Panel>

      <ReviewDrawer
        row={reviewing}
        open={reviewing !== null}
        onOpenChange={(next) => !next && setReviewing(null)}
      />
    </>
  );
}

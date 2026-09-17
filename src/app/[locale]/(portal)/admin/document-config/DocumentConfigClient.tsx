/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { saveLenderDocumentConfigAction } from "@/app/[locale]/(portal)/admin/document-config/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/twMergeUtils";
import type { LenderDocConfigRow } from "@/services/portal/lenderDocumentConfig.server";

/** One row of the on-page draft — same shape `LenderDocConfigRow` carries, plus a stable React
 *  key that survives edits (the server `id` is regenerated on every save, so a row added this
 *  session has no server id yet to key off). */
type DraftRow = Readonly<{
  key: string;
  slug?: string;
  name: string;
  description?: string;
  required: boolean;
}>;

function toDraft(rows: readonly LenderDocConfigRow[]): DraftRow[] {
  return rows.map((r) => ({
    key: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    required: r.required,
  }));
}

export function DocumentConfigClient({
  lenders,
  selectedLenderId,
  initialRows,
}: Readonly<{
  lenders: { id: string; name: string }[];
  selectedLenderId: string | null;
  initialRows: LenderDocConfigRow[];
}>) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>(() => toDraft(initialRows));
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedLenderName =
    lenders.find((l) => l.id === selectedLenderId)?.name ?? "—";
  const dirty =
    rows.length !== initialRows.length ||
    rows.some((row, i) => {
      const original = initialRows[i];
      return (
        !original ||
        row.name !== original.name ||
        row.required !== original.required
      );
    });

  function onLenderChange(nextId: string) {
    router.push(`?lender=${encodeURIComponent(nextId)}`, { scroll: false });
  }

  function onRequiredChange(key: string, required: boolean) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, required } : r)));
  }

  function onRemove(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function onCancel() {
    setRows(toDraft(initialRows));
  }

  function onAdd(doc: { name: string; description?: string; required: boolean }) {
    setRows((prev) => [
      ...prev,
      { key: `new_${Date.now()}`, name: doc.name, description: doc.description, required: doc.required },
    ]);
    setAddOpen(false);
  }

  function onSave() {
    if (!selectedLenderId) return;
    if (rows.length === 0) {
      toast.error("Add at least one document before saving.");
      return;
    }
    startTransition(async () => {
      const result = await saveLenderDocumentConfigAction(
        selectedLenderId,
        rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          description: r.description,
          required: r.required,
        }))
      );
      if (!result.ok) {
        toast.error(result.error ?? "That configuration could not be saved.");
        return;
      }
      toast.success(`Document configuration saved for ${selectedLenderName}.`);
    });
  }

  return (
    <div>
      <Panel
        size="compact"
        title="Document Requirements"
        description={`What ${selectedLenderName}'s INITIAL claims ask for, in order.`}
        // The lender picker sits in the panel header rather than a card of its own, so the whole
        // configuration fits on one screen without scrolling.
        actions={
          <div className="relative w-[240px]">
            <select
              aria-label="Select lender"
              value={selectedLenderId ?? ""}
              onChange={(e) => onLenderChange(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-[13px] font-medium text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              {lenders.length === 0 && <option value="">No lenders</option>}
              {lenders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-9 px-3.5 text-[11px]">Document</TableHead>
                <TableHead className="h-9 px-3.5 text-[11px]">
                  Mandatory / Optional
                </TableHead>
                <TableHead className="h-9 px-3.5 text-[11px]">Status</TableHead>
                <TableHead className="h-9 px-3.5 text-[11px]">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-[13px] text-neutral-500"
                  >
                    No documents configured — add at least one before saving.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="px-3.5 py-1.5">
                      <span className="block text-[13px] font-medium text-neutral-900">
                        {row.name}
                      </span>
                      {row.description && (
                        <span className="block text-[11.5px] text-neutral-500">
                          {row.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3.5 py-1.5">
                      <div className="relative inline-block">
                        <select
                          aria-label={`Requirement for ${row.name}`}
                          value={row.required ? "MANDATORY" : "OPTIONAL"}
                          onChange={(e) =>
                            onRequiredChange(row.key, e.target.value === "MANDATORY")
                          }
                          className={cn(
                            "h-7 appearance-none rounded-full border py-0 pl-3 pr-7 text-[12px] font-semibold outline-none focus:ring-2",
                            row.required
                              ? "border-warning/30 bg-warning/10 text-warning focus:ring-warning/20"
                              : "border-neutral-200 bg-neutral-50 text-neutral-600 focus:ring-neutral-300/40"
                          )}
                        >
                          <option value="MANDATORY">Mandatory</option>
                          <option value="OPTIONAL">Optional</option>
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 opacity-60" />
                      </div>
                    </TableCell>
                    <TableCell className="px-3.5 py-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-success-700">
                        <span className="size-1.5 rounded-full bg-current opacity-70" />
                        Active
                      </span>
                    </TableCell>
                    <TableCell className="px-3.5 py-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onRemove(row.key)}
                        className="h-7 text-destructive hover:border-destructive/40 hover:bg-destructive/5"
                      >
                        <Trash2Icon className="size-3.5" /> Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-2.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={!selectedLenderId}
          >
            <PlusIcon className="size-3.5" /> Add Document
          </Button>

          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-[12px] text-neutral-500">
                Unsaved changes
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={pending || !dirty}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={pending || !selectedLenderId}
            >
              {pending ? "Saving…" : "Save Configuration"}
            </Button>
          </div>
        </div>
      </Panel>

      <AddDocumentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingNames={rows.map((r) => r.name)}
        onAdd={onAdd}
      />
    </div>
  );
}

function AddDocumentDialog({
  open,
  onOpenChange,
  existingNames,
  onAdd,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: readonly string[];
  onAdd: (doc: { name: string; description?: string; required: boolean }) => void;
}>) {
  const [name, setName] = useState("");
  const [requirement, setRequirement] = useState<"MANDATORY" | "OPTIONAL">(
    "MANDATORY"
  );
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setRequirement("MANDATORY");
    setDescription("");
    setError("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Document name is required.");
      return;
    }
    if (existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError("This lender already has a document with that name.");
      return;
    }
    onAdd({
      name: trimmed,
      description: description.trim() || undefined,
      required: requirement === "MANDATORY",
    });
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>
            Adds a document requirement for this lender only — it will not appear
            for any other lender.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Document Name <span className="text-red-500">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. NOC"
              className={cn(
                "h-9 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:ring-2",
                error
                  ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                  : "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/20"
              )}
            />
            {error && (
              <span role="alert" className="mt-1 block text-[12px] font-medium text-destructive">
                {error}
              </span>
            )}
          </label>

          <fieldset>
            <legend className="mb-1.5 block text-[12.5px] font-medium text-neutral-700">
              Requirement <span className="text-red-500">*</span>
            </legend>
            <div className="flex gap-2">
              {(["MANDATORY", "OPTIONAL"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRequirement(option)}
                  aria-pressed={requirement === option}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                    requirement === option
                      ? "border-brand-primary bg-brand-light/60 text-brand-dark"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {option === "MANDATORY" ? "Mandatory" : "Optional"}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional — shown to the lender under this document."
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Add Document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  MessageSquareWarningIcon,
  SaveIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  saveDraftAction,
  submitClaimAction,
} from "@/app/[locale]/(portal)/initiate-claim/actions";
import { Panel } from "@/components/portal/Panel";
import { StatusPill } from "@/components/portal/StatusPill";
import { UploadDialog } from "@/components/portal/UploadDialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClaimField, ClaimTypeConfig } from "@/config/claimConfig";
import { cn } from "@/lib/utils/twMergeUtils";
import type { RequirementRow } from "@/services/portal/requirements.server";
import type { ClaimQuery, ClaimStatus } from "@/server/mock/types";

const FIELD =
  "h-9 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900 outline-none focus:ring-2";
const OK = "border-neutral-200 focus:border-brand-primary focus:ring-brand-primary/20";
const BAD = "border-destructive focus:border-destructive focus:ring-destructive/20";

/** A document still counts as outstanding until it is with IMGC or approved. */
function outstanding(doc: RequirementRow): boolean {
  return doc.status !== "UNDER_REVIEW" && doc.status !== "APPROVED";
}

/**
 * The claim form and its checklist.
 *
 * Both are rendered entirely from `ClaimTypeConfig` — there is no field or document named in
 * this file. Adding a claim type is a config entry, and this component renders it unchanged.
 */
export function ClaimWorkspace({
  accountId,
  claimId,
  claimNo,
  status,
  config,
  initialFields,
  documents,
  openQuery,
  backHref,
}: Readonly<{
  accountId: string;
  claimId: string;
  claimNo: string;
  status: ClaimStatus;
  config: ClaimTypeConfig;
  initialFields: Record<string, string>;
  documents: RequirementRow[];
  openQuery: ClaimQuery | null;
  backHref: string;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(initialFields);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState<RequirementRow | null>(null);

  const set = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setTouched(true);
  }, []);

  // The same rule the server enforces in `checkSubmittable`, mirrored here so the button can
  // say *why* it is disabled rather than just being dead.
  const missingFields = useMemo(
    () =>
      config.fields
        .filter((f) => f.required && !String(values[f.id] ?? "").trim())
        .map((f) => f.label),
    [config.fields, values]
  );
  const missingDocs = useMemo(
    () => documents.filter((d) => d.required && outstanding(d)).map((d) => d.name),
    [documents]
  );
  const canSubmit = missingFields.length === 0 && missingDocs.length === 0;

  const resubmitting = status === "QUERY_RAISED";
  const locked =
    status === "APPROVED" || status === "REJECTED" || status === "CLOSED";

  const onSave = useCallback(() => {
    startTransition(async () => {
      const result = await saveDraftAction(accountId, claimId, values);
      if (!result.ok) {
        toast.error(result.error ?? "That could not be saved.");
        return;
      }
      setTouched(false);
      toast.success("Draft saved.");
      router.refresh();
    });
  }, [accountId, claimId, values, router]);

  const onSubmit = useCallback(() => {
    startTransition(async () => {
      const result = await submitClaimAction(accountId, claimId, values);
      if (!result.ok) {
        toast.error(result.error ?? "That claim could not be submitted.");
        return;
      }
      setTouched(false);
      toast.success(
        resubmitting
          ? `${claimNo} resubmitted — back with IMGC for review.`
          : `${claimNo} submitted to IMGC.`
      );
      router.refresh();
    });
  }, [accountId, claimId, values, claimNo, resubmitting, router]);

  const onCancel = useCallback(() => {
    // Discards only what was typed since the last save — the saved claim is untouched.
    setValues(initialFields);
    setTouched(false);
    toast.info("Unsaved changes discarded.");
    router.push(backHref);
  }, [initialFields, backHref, router]);

  return (
    <div className="space-y-4">
      {openQuery && (
        <QueryBanner query={openQuery} />
      )}

      {/* ── Dynamic fields ───────────────────────────────────── */}
      <Panel
        title={`${config.label} details`}
        description={config.description}
        actions={<StatusPill status={status} />}
      >
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {config.fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={values[field.id] ?? ""}
              invalid={
                touched && field.required && !String(values[field.id] ?? "").trim()
              }
              disabled={locked}
              onChange={set}
            />
          ))}
        </div>
      </Panel>

      {/* ── Dynamic checklist ────────────────────────────────── */}
      <Panel
        title="Required documents"
        description={`${documents.filter((d) => d.required && !outstanding(d)).length} of ${documents.filter((d) => d.required).length} mandatory documents are in.`}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <span className="font-medium text-neutral-900">{doc.name}</span>
                    <span className="block text-[11.5px] text-neutral-500">
                      {doc.category}
                      {doc.version > 0 && ` · v${doc.version}`}
                    </span>
                    {doc.description && (
                      <span className="mt-1 block text-[11.5px] text-neutral-500">
                        {doc.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                        doc.required
                          ? "bg-neutral-100 text-neutral-600"
                          : "bg-neutral-50 text-neutral-400"
                      )}
                    >
                      {doc.required ? "Required" : "Optional"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={doc.status} />
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="line-clamp-2 text-[12.5px] text-neutral-600">
                      {doc.latestRemark || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {locked || doc.status === "APPROVED" ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-success-700">
                        <CheckCircle2Icon className="size-3.5" />
                        {doc.status === "APPROVED" ? "Approved" : "Closed"}
                      </span>
                    ) : (
                      <Button size="xs" onClick={() => setUploading(doc)}>
                        <UploadIcon />
                        {doc.version > 0 ? "Replace" : "Upload"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* ── Save / Submit / Cancel ───────────────────────────── */}
      {!locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-white px-5 py-3.5 shadow-sm">
          <div className="min-w-0 text-[12.5px]">
            {canSubmit ? (
              <p className="flex items-center gap-1.5 font-medium text-success-700">
                <CheckCircle2Icon className="size-4" />
                Everything mandatory is in — you can{" "}
                {resubmitting ? "resubmit" : "submit"} this claim.
              </p>
            ) : (
              <p className="text-neutral-500">
                <span className="font-medium text-neutral-700">
                  {resubmitting ? "Resubmit" : "Save &amp; Submit"} unlocks once:
                </span>{" "}
                {[
                  missingFields.length
                    ? `${missingFields.length} field(s) — ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? "…" : ""}`
                    : "",
                  missingDocs.length
                    ? `${missingDocs.length} document(s) — ${missingDocs.slice(0, 3).join(", ")}${missingDocs.length > 3 ? "…" : ""}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("; ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
              <XIcon /> Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={onSave} disabled={pending}>
              <SaveIcon /> Save
            </Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={pending || !canSubmit}
              title={canSubmit ? undefined : "Complete the outstanding items first."}
            >
              <SendIcon /> {resubmitting ? "Save & Resubmit" : "Save & Submit"}
            </Button>
          </div>
        </div>
      )}

      <UploadDialog
        row={uploading}
        open={uploading !== null}
        onOpenChange={(next) => !next && setUploading(null)}
      />
    </div>
  );
}

/** Renders one configured field. The only place `FieldType` is turned into an input. */
function FieldInput({
  field,
  value,
  invalid,
  disabled,
  onChange,
}: Readonly<{
  field: ClaimField;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (id: string, value: string) => void;
}>) {
  const common = {
    id: field.id,
    value,
    disabled,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => onChange(field.id, e.target.value),
    className: cn(FIELD, invalid ? BAD : OK, disabled && "bg-neutral-50"),
  };

  return (
    <label className={field.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
      <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </span>

      {field.type === "select" ? (
        <select {...common}>
          <option value="">Choose…</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          {...common}
          rows={2}
          placeholder={field.placeholder}
          className={cn(
            "w-full rounded-lg border bg-white px-3 py-2 text-[13px] outline-none focus:ring-2",
            invalid ? BAD : OK,
            disabled && "bg-neutral-50"
          )}
        />
      ) : (
        <input
          {...common}
          type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"}
          inputMode={field.type === "currency" ? "numeric" : undefined}
          placeholder={field.placeholder}
        />
      )}

      {field.helpText && (
        <span className="mt-1 block text-[11.5px] text-neutral-500">
          {field.helpText}
        </span>
      )}
      {invalid && (
        <span role="alert" className="mt-1 block text-[11.5px] font-medium text-destructive">
          {field.label} is required.
        </span>
      )}
    </label>
  );
}

/** What IMGC asked for, and what the lender has to do about it. */
function QueryBanner({ query }: Readonly<{ query: ClaimQuery }>) {
  return (
    <section className="rounded-xl border border-warning/40 bg-warning/8 px-5 py-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <MessageSquareWarningIcon className="size-4 text-warning" />
        <h2 className="text-[14px] font-semibold text-neutral-950">Query raised</h2>
        <span className="text-[12px] text-neutral-600">
          by {query.raisedByName} ·{" "}
          {new Date(query.raisedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </header>

      <dl className="space-y-1.5 text-[13px]">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-neutral-700">Reason:</dt>
          <dd className="text-neutral-800">{query.reason}</dd>
        </div>
        {query.remarks && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">Remarks:</dt>
            <dd className="text-neutral-700">{query.remarks}</dd>
          </div>
        )}
        {query.requestedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <dt className="shrink-0 font-semibold text-neutral-700">Required action:</dt>
            <dd className="flex flex-wrap gap-1.5">
              {query.requestedDocuments.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-medium text-neutral-800 ring-1 ring-warning/40"
                >
                  Upload {name}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

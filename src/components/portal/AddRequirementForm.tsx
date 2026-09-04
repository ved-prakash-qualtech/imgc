"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  APPLICABLE_PRODUCTS,
  CASE_TYPES,
  DOCUMENT_CATEGORIES,
  PRIORITIES,
  SLA_PRESETS,
  dueDateFromSla,
} from "@/constants/documents";
import type { RequirementInput } from "@/services/portal/claims.server";

const FIELD =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

function Field({
  label,
  hint,
  className,
  children,
}: Readonly<{
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11.5px] text-neutral-500">{hint}</span>
      )}
    </label>
  );
}

/**
 * IMGC's configurable document requirement.
 *
 * Everything past the name is optional on purpose: the common case is "add NOC, mandatory, due in
 * a week", and a form that demanded a category and a case type for that would only get filled
 * with noise. The product defaults to the account's own, so the usual answer needs no thought.
 */
export interface CaseOption {
  id: string;
  loanNo: string;
  borrowerName: string;
  product: string;
}

export function AddRequirementForm({
  accountProduct,
  cases,
  selectedCaseId,
  onCaseChange,
  initial,
  submitLabel = "Add to checklist",
  onSubmit,
  onCancel,
}: Readonly<{
  accountProduct: string;
  /** When given, the form offers a case picker — used on the cross-case page. */
  cases?: readonly CaseOption[];
  selectedCaseId?: string;
  onCaseChange?: (caseId: string) => void;
  /** Present when editing an existing requirement. */
  initial?: Partial<RequirementInput>;
  submitLabel?: string;
  onSubmit: (input: RequirementInput) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}>) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<string>(
    initial?.category ?? DOCUMENT_CATEGORIES[0]
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [required, setRequired] = useState(initial?.required ?? true);
  const [product, setProduct] = useState<string>(
    initial?.applicableProduct ??
      ((APPLICABLE_PRODUCTS as readonly string[]).includes(accountProduct)
        ? accountProduct
        : APPLICABLE_PRODUCTS[0])
  );
  const [caseType, setCaseType] = useState<string>(
    initial?.applicableCaseType ?? CASE_TYPES[1]
  );
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ? initial.dueDate.slice(0, 10) : ""
  );
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [priority, setPriority] = useState<RequirementInput["priority"]>(
    initial?.priority ?? "NORMAL"
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({
        name,
        category,
        description,
        required,
        applicableProduct: product,
        applicableCaseType: caseType,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : "",
        remarks,
        active,
        priority,
      });
      if (!result.ok) {
        toast.error(result.error ?? "That requirement could not be added.");
        return;
      }
      toast.success(`"${name}" ${initial ? "updated" : "added to the checklist"}.`);
      onCancel();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 border-b border-neutral-100 bg-neutral-25 px-5 py-4"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases && (
          <Field label="Select case *">
            <select
              value={selectedCaseId ?? ""}
              onChange={(e) => onCaseChange?.(e.target.value)}
              required
              className={FIELD}
            >
              <option value="">Choose a case…</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.loanNo} · {c.borrowerName}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Document name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            // The form opens on the user's own "Add requirement" press, so this is the field
            // they came for and focus follows the action they took.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder="e.g. NOC from the society"
            className={FIELD}
          />
        </Field>

        <Field label="Document type / category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={FIELD}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due date / SLA" hint="Leave blank for no SLA.">
          <div className="flex gap-1.5">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={FIELD}
            />
            <select
              value=""
              aria-label="Set the due date from an SLA preset"
              onChange={(e) => {
                const days = Number(e.target.value);
                if (days) setDueDate(dueDateFromSla(days).slice(0, 10));
              }}
              className={`${FIELD} w-24 shrink-0`}
            >
              <option value="">SLA…</option>
              {SLA_PRESETS.map((s) => (
                <option key={s.days} value={s.days}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Applicable product">
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className={FIELD}
          >
            {APPLICABLE_PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Applicable case type">
          <select
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            className={FIELD}
          >
            {CASE_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as RequirementInput["priority"])
            }
            className={FIELD}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Remarks" hint="IMGC's own note against this requirement.">
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Raised after the valuation review"
            className={FIELD}
          />
        </Field>
      </div>

      <Field
        label="Description / instructions"
        hint="Shown to the lender under the requirement — say exactly what to provide."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="e.g. Society NOC on letterhead, signed and dated within the last 90 days."
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-5">
        <fieldset className="flex items-center gap-4">
          <legend className="sr-only">Requirement is mandatory or optional</legend>
          {[
            { label: "Required", value: true },
            { label: "Optional", value: false },
          ].map((option) => (
            <label
              key={option.label}
              className="flex cursor-pointer items-center gap-1.5 text-[13px] text-neutral-700"
            >
              <input
                type="radio"
                name="required"
                checked={required === option.value}
                onChange={() => setRequired(option.value)}
                className="size-4 accent-[var(--brand-primary)]"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-neutral-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4 accent-[var(--brand-primary)]"
          />
          Active
          <span className="text-[11.5px] text-neutral-500">
            (inactive is hidden from the lender and does not block submission)
          </span>
        </label>

        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            <PlusIcon /> {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

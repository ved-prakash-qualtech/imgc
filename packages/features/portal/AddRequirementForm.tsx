/* eslint-disable react-perf/jsx-no-new-function-as-prop -- pre-existing in this file: the indexed maps are declared
   here with literal keys, and the inline props are small local values. Left as-is so the
   type-scale change stays a class rename. */
"use client";

import { useServerErrorMessage } from "@imgc/lib/serverErrorMessage";
import type {
  ServerErrorCode,
  ServerErrorParams,
} from "@imgc/config/errorCodes";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@imgc/ui/ui/button";
import {
  APPLICABLE_PRODUCTS,
  CASE_TYPES,
  DOCUMENT_CATEGORIES,
  PRIORITIES,
  SLA_PRESETS,
  dueDateFromSla,
} from "@imgc/constants/documents";
import type { RequirementInput } from "@imgc/data/services/portal/claims.server";

const FIELD =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-ui-subhead text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";

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
      <span className="mb-1 block text-ui-body-lg font-medium text-neutral-700">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-ui-body-sm text-neutral-500">
          {hint}
        </span>
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
  submitLabel,
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
  onSubmit: (input: RequirementInput) => Promise<{
    ok: boolean;
    code?: ServerErrorCode;
    codeParams?: ServerErrorParams;
  }>;
  onCancel: () => void;
}>) {
  const errorText = useServerErrorMessage();
  const t = useTranslations("addRequirement");
  const tFallback = useTranslations("actionFallbacks");
  const tOpt = useTranslations("addRequirement.options");
  // Stored values stay the English identifiers; only what the user reads is looked up.
  const optionLabel = (value: string): string => {
    const key = value
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(" ")
      .map((w, i) =>
        i === 0
          ? w.toLowerCase()
          : w[0]!.toUpperCase() + w.slice(1).toLowerCase()
      )
      .join("");
    return tOpt.has(key) ? tOpt(key) : value;
  };
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
        toast.error(errorText(result) ?? tFallback("requirementAddFailed"));
        return;
      }
      toast.success(t(initial ? "toastUpdated" : "toastAdded", { name }));
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
          <Field label={t("selectCase")}>
            <select
              value={selectedCaseId ?? ""}
              onChange={(e) => onCaseChange?.(e.target.value)}
              required
              className={FIELD}
            >
              <option value="">{t("chooseCase")}</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.loanNo} · {c.borrowerName}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t("documentName")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            // The form opens on the user's own "Add requirement" press, so this is the field
            // they came for and focus follows the action they took.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder={t("documentNamePlaceholder")}
            className={FIELD}
          />
        </Field>

        <Field label={t("category")}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={FIELD}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {optionLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("dueDate")} hint={t("dueDateHint")}>
          <div className="flex gap-1.5">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={FIELD}
            />
            <select
              value=""
              aria-label={t("slaPresetLabel")}
              onChange={(e) => {
                const days = Number(e.target.value);
                if (days) setDueDate(dueDateFromSla(days).slice(0, 10));
              }}
              className={`${FIELD} w-24 shrink-0`}
            >
              <option value="">{t("slaPlaceholder")}</option>
              {SLA_PRESETS.map((s) => (
                <option key={s.days} value={s.days}>
                  {t("slaDays", { days: s.days })}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label={t("product")}>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className={FIELD}
          >
            {APPLICABLE_PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {optionLabel(p)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("caseType")}>
          <select
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            className={FIELD}
          >
            {CASE_TYPES.map((c) => (
              <option key={c} value={c}>
                {optionLabel(c)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("priority")}>
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

        <Field label={t("remarks")} hint={t("remarksHint")}>
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={t("remarksPlaceholder")}
            className={FIELD}
          />
        </Field>
      </div>

      <Field label={t("description")} hint={t("descriptionHint")}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t("descriptionPlaceholder")}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-ui-subhead text-neutral-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-5">
        <fieldset className="flex items-center gap-4">
          <legend className="sr-only">{t("mandatoryOrOptional")}</legend>
          {[
            { label: t("required"), value: true },
            { label: t("optional"), value: false },
          ].map((option) => (
            <label
              key={option.label}
              className="flex cursor-pointer items-center gap-1.5 text-ui-subhead text-neutral-700"
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

        <label className="flex cursor-pointer items-center gap-2 text-ui-subhead text-neutral-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4 accent-[var(--brand-primary)]"
          />
          {t("active")}
          <span className="text-ui-body-sm text-neutral-500">
            {t("inactiveHint")}
          </span>
        </label>

        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            <PlusIcon /> {submitLabel ?? t("submitDefault")}
          </Button>
        </div>
      </div>
    </form>
  );
}

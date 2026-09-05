"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/portal/Panel";
import { fieldVisible } from "@/config/claimConfig";
import type { ClaimField } from "@/config/claimConfig";

/**
 * The claim-level data-entry fields declared on the claim type's config (Claims Program,
 * Ineligible Claim, and its conditional reason). Rendered generically off `ClaimField` so a new
 * field only ever needs adding to `claimConfig` — never a new case here.
 */
export function ClaimProgramFields({
  fields,
  values,
  onChange,
  disabled,
}: Readonly<{
  fields: readonly ClaimField[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled: boolean;
}>) {
  if (fields.length === 0) return null;

  return (
    <Panel title="Claim details" description="Required before this claim can be submitted.">
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        {fields.map((field) => {
          if (!fieldVisible(field, values)) return null;
          const value = values[field.id] ?? "";

          return (
            <div
              key={field.id}
              className={field.type === "textarea" ? "sm:col-span-2" : undefined}
            >
              <Label htmlFor={field.id} className="mb-1.5 block text-[12.5px] text-neutral-600">
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>

              {field.type === "select" ? (
                <Select
                  value={value || undefined}
                  onValueChange={(next) => onChange(field.id, String(next))}
                  disabled={disabled}
                >
                  <SelectTrigger id={field.id} className="w-full">
                    <SelectValue placeholder={field.placeholder ?? "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  id={field.id}
                  value={value}
                  placeholder={field.placeholder}
                  disabled={disabled}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
              ) : null}

              {field.helpText && (
                <p className="mt-1 text-[11.5px] text-neutral-400">{field.helpText}</p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

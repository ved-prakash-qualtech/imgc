"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CONDITION_OPERATORS } from "@/constants/identity-control/policy.constants";
import type { PolicyCondition } from "@/types/identity-control";
import type { ApplicationAttributeDropdown } from "@/types/identity-control/policy.types";

export function PolicyConditionRow({
  c,
  onChange,
  onRemove,
  attributeOptions,
}: {
  c: PolicyCondition;
  onChange: (next: PolicyCondition) => void;
  onRemove: () => void;
  attributeOptions?: ApplicationAttributeDropdown[];
}) {
  const useRhsAttr = !!c.rhsAttribute;

  const resolvedLabel = attributeOptions
    ? (attributeOptions.find((o) => o.id === c.attribute)?.label ?? c.attribute)
    : (CONDITION_OPERATORS.find((o) => o.op === c.operator)?.label ??
      c.operator);

  return (
    <div className="grid grid-cols-12 items-center gap-2 rounded-md border border-border bg-card px-2 py-2">
      <Input
        className="col-span-3 h-8 text-xs"
        value={c.source}
        onChange={(e) => onChange({ ...c, source: e.target.value })}
        placeholder="Enter key"
      />
      <div className="col-span-3">
        <Select
          value={c.attribute || ""}
          onValueChange={(v) => onChange({ ...c, attribute: v || "" })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <span className="truncate text-xs">
              {c.attribute ? (
                resolvedLabel
              ) : (
                <span className="text-muted-foreground">Select attribute</span>
              )}
            </span>
          </SelectTrigger>
          <SelectContent>
            {attributeOptions
              ? attributeOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))
              : CONDITION_OPERATORS.map((o) => (
                  <SelectItem key={o.op} value={o.op}>
                    {o.label}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        className="col-span-4 h-8 text-xs"
        value={useRhsAttr ? (c.rhsAttribute ?? "") : c.value}
        onChange={(e) =>
          useRhsAttr
            ? onChange({ ...c, rhsAttribute: e.target.value, value: "" })
            : onChange({ ...c, value: e.target.value })
        }
        placeholder="Enter value"
      />
      <div className="col-span-2 flex justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={
            useRhsAttr ? "Switch to literal value" : "Compare to another field"
          }
          onClick={() =>
            onChange({
              ...c,
              rhsAttribute: useRhsAttr ? undefined : "time.current_time",
              value: "",
            })
          }
        >
          <span className="text-[10px] font-mono">
            {useRhsAttr ? "abc" : "≡"}
          </span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

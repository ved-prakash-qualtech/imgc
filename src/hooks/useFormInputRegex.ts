"use client";

import { useCallback, useMemo } from "react";

import {
  sanitizeFormInputValue,
  shouldUseSanitizedChange,
} from "@/lib/utils/formInputSanitize";
import type { FormInputRegexType } from "@/types/forms";

export type UseFormInputRegexOptions = {
  maxLength?: number;
  regexType?: FormInputRegexType;
};

export function useFormInputRegex({
  maxLength,
  regexType,
}: UseFormInputRegexOptions) {
  const shouldSanitizeOnChange = useMemo(
    () => shouldUseSanitizedChange(regexType, maxLength),
    [regexType, maxLength]
  );

  const sanitizeValue = useCallback(
    (raw: string) => sanitizeFormInputValue(raw, regexType, maxLength),
    [regexType, maxLength]
  );

  return {
    regexType,
    shouldSanitizeOnChange,
    sanitizeValue,
  };
}

"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { isServerErrorCode, type ServerErrorParams } from "@/config/errorCodes";

/** The failure half of any action result — only the parts a message needs. */
type Failure =
  | Readonly<{
      code?: string;
      codeParams?: ServerErrorParams;
    }>
  | null
  | undefined
  | void;

/**
 * Turns the code an action came back with into a sentence in the reader's language.
 *
 * Returns `null` when there is no code to resolve, so the call site keeps its own fallback:
 *
 * ```tsx
 * const errorText = useServerErrorMessage();
 * toast.error(errorText(result) ?? t("toast.saveFailed"));
 * ```
 *
 * An unrecognised code also yields `null` rather than leaking `SOME_RAW_CODE` into a toast —
 * that happens when a deployed client meets a newer service, and the generic fallback is a
 * better answer than a identifier the reader cannot act on.
 */
export function useServerErrorMessage(): (failure: Failure) => string | null {
  const t = useTranslations("serverErrors");
  return useCallback(
    (failure: Failure): string | null => {
      const code = failure?.code;
      if (!isServerErrorCode(code)) return null;
      return t(code, failure?.codeParams ?? {});
    },
    [t]
  );
}

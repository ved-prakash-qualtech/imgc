"use client";

import { useCallback, useState } from "react";

/**
 * Propagate async / event-handler errors to the nearest error boundary.
 *
 * React error boundaries only catch errors thrown during render. Errors thrown
 * in event handlers, `setTimeout`, or promise rejections are invisible to them.
 * Re-throwing through component state surfaces those errors to the boundary.
 *
 * @example
 * const handleError = useErrorHandler();
 * const onSubmit = async () => {
 *   try {
 *     await saveData(payload);
 *   } catch (error) {
 *     handleError(error);
 *   }
 * };
 */
export function useErrorHandler(): (error: unknown) => void {
  const [, setError] = useState<unknown | null>(null);

  return useCallback((error: unknown) => {
    setError(() => {
      throw error instanceof Error
        ? error
        : new Error(String(error), { cause: error });
    });
  }, []);
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { getLocalItem, setLocalItem } from "@/lib/storage";

function readParsed<T>(key: string, initialValue: T): T {
  return getLocalItem<T>(key) ?? initialValue;
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [stored, setStored] = useState<T>(initialValue);

  useEffect(() => {
    queueMicrotask(() => {
      setStored(readParsed(key, initialValue));
    });
  }, [key, initialValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          setLocalItem(key, next);
        } catch {
          // ignore quota / private mode
        }
        return next;
      });
    },
    [key]
  );

  return [stored, setValue] as const;
}

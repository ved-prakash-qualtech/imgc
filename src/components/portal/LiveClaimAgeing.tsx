"use client";

import { useEffect, useState } from "react";
import type { ClaimStatusEntry } from "@/server/mock/types";

// Shared ticking mechanism for efficiency (one interval for the whole page)
const subscribers = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  subscribers.add(cb);
  if (!ticker) {
    ticker = setInterval(() => {
      for (const fn of subscribers) fn();
    }, 1000);
  }
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

function useSharedTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    return subscribe(() => setNow(Date.now()));
  }, [active]);
  return now;
}

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d)}d ${pad(h % 24)}h ${pad(m % 60)}m ${pad(s % 60)}s`;
}

export function LiveClaimAgeing({
  statusHistory,
  hideStatusText,
}: {
  statusHistory?: ClaimStatusEntry[];
  hideStatusText?: boolean;
}) {
  const initiated = statusHistory?.find((h) => h.status === "INITIATED");
  const completed = statusHistory?.find(
    (h) => h.status === "APPROVED" || h.status === "REJECTED"
  );

  const isStarted = Boolean(initiated);
  const isCompleted = Boolean(completed);

  const now = useSharedTick(isStarted && !isCompleted);

  if (!isStarted || !statusHistory || statusHistory.length === 0) return <>—</>;

  const startMs = new Date(initiated!.at).getTime();
  const endMs = isCompleted ? new Date(completed!.at).getTime() : now;

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {formatDuration(endMs - startMs)}
      {!hideStatusText && <> &middot; {isCompleted ? "Completed" : "Live"}</>}
    </span>
  );
}

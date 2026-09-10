"use client";

import { useCallback, useState, type ReactNode } from "react";
import React from "react";

import { cn } from "@/lib/utils/twMergeUtils";

const TABS = [
  { key: "loan-details", label: "Loan Details" },
  { key: "status", label: "Status & Query" },
  { key: "documents", label: "Documents" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * The Track Claim screen's own tab bar.
 *
 * Each tab's content is passed in as a slot rather than fetched here: the page stays a server
 * component that loads the claim once, and this only decides which of the three is on screen.
 *
 * Every panel stays mounted and the inactive ones are hidden with CSS rather than unmounted —
 * switching to Documents and back must not discard a half-typed query response or an upload in
 * flight, which unmounting `QueryResponseSection` would do.
 */
export function ClaimDetailTabs({
  loanDetails,
  statusAndQuery,
  documents,
  history,
  backLink,
}: Readonly<{
  loanDetails: ReactNode;
  statusAndQuery: ReactNode;
  documents: ReactNode;
  history: ReactNode;
  /** Optional ← Back link rendered on the left of the tab bar row (server-supplied). */
  backLink?: ReactNode;
}>) {
  const [tab, setTab] = useState<TabKey>("loan-details");

  const handleTabClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const key = e.currentTarget.dataset["tabKey"] as TabKey;
      if (key) setTab(key);
    },
    []
  );

  const panels: ReadonlyArray<{ key: TabKey; content: ReactNode }> = [
    { key: "loan-details", content: loanDetails },
    { key: "status", content: statusAndQuery },
    { key: "documents", content: documents },
    { key: "history", content: history },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Tab bar row: optional Back link + pill switcher ── */}
      <div className="mb-4 flex shrink-0 items-center gap-3">
        {backLink}
        <div
          className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1"
          role="tablist"
          aria-label="Claim sections"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              id={`claim-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`claim-panel-${t.key}`}
              onClick={handleTabClick}
              data-tab-key={t.key}
              className={cn(
                "rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors",
                tab === t.key
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {panels.map((p) => (
        <div
          key={p.key}
          id={`claim-panel-${p.key}`}
          role="tabpanel"
          aria-labelledby={`claim-tab-${p.key}`}
          className={cn(
            "flex-1 flex-col min-h-0 space-y-4",
            tab !== p.key ? "hidden" : "flex",
            p.key === "status"
              ? "overflow-hidden"
              : "overflow-y-auto custom-scrollbar pr-1"
          )}
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}

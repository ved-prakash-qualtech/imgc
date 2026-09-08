"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/twMergeUtils";

const TABS = [
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
  statusAndQuery,
  documents,
  history,
}: Readonly<{
  statusAndQuery: ReactNode;
  documents: ReactNode;
  history: ReactNode;
}>) {
  const [tab, setTab] = useState<TabKey>("status");

  const panels: ReadonlyArray<{ key: TabKey; content: ReactNode }> = [
    { key: "status", content: statusAndQuery },
    { key: "documents", content: documents },
    { key: "history", content: history },
  ];

  return (
    <div>
      <div
        className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200"
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
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
              tab === t.key
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {panels.map((p) => (
        <div
          key={p.key}
          id={`claim-panel-${p.key}`}
          role="tabpanel"
          aria-labelledby={`claim-tab-${p.key}`}
          className={cn("space-y-4", tab !== p.key && "hidden")}
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}

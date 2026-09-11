/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import type { ReactNode } from "react";
import React from "react";

export function ClaimDetailSinglePage({
  loanDetails,
  statusAndQuery,
  documents,
  history,
  backLink,
  showSectionNav,
}: Readonly<{
  loanDetails: ReactNode;
  statusAndQuery: ReactNode;
  documents: ReactNode;
  history: ReactNode;
  backLink?: ReactNode;
  showSectionNav?: boolean;
}>) {
  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navItems = [
    { id: "loan-details", label: "Loan Details" },
    { id: "status-query", label: "Status & Query" },
    { id: "documents", label: "Documents" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header row: Back link + Section Nav ── */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          {backLink}
          {showSectionNav && (
            <nav className="flex items-center gap-5 text-[12.5px] font-medium text-neutral-500">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => scrollTo(e, item.id)}
                  className="hover:text-brand-primary transition-colors drop-shadow-sm"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-12">
        {/* Loan Details Section */}
        <section id="loan-details" className="scroll-mt-4">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
            Loan Details
          </h2>
          {loanDetails}
        </section>

        {/* Status & Query Section */}
        <section id="status-query" className="scroll-mt-4">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
            Status & Query
          </h2>
          <div className="flex flex-col gap-4">{statusAndQuery}</div>
        </section>

        {/* Documents Section */}
        <section id="documents" className="scroll-mt-4">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
            Documents
          </h2>
          {documents}
        </section>

        {/* History Section */}
        <section id="history" className="scroll-mt-4">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
            History
          </h2>
          {history}
        </section>
      </div>
    </div>
  );
}

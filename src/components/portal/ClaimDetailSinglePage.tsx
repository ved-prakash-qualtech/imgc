/* eslint-disable react-perf/jsx-no-new-function-as-prop */
"use client";

import type { ReactNode } from "react";
import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils/twMergeUtils";

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
  ];
  if (history) {
    navItems.push({ id: "history", label: "Audit Trail" });
  }

  const [activeSection, setActiveSection] = useState<string>("loan-details");

  useEffect(() => {
    if (!showSectionNav) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-10% 0px -60% 0px" }
    );

    navItems.forEach((item) => {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [showSectionNav, history]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header row: Back link + Section Nav ── */}
      <div className="mb-4 flex shrink-0 flex-wrap items-end gap-8 border-b border-neutral-200 px-1 pt-1">
        {backLink && (
          <div className="pb-2">
            {backLink}
          </div>
        )}
        {showSectionNav && (
          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => scrollTo(e, item.id)}
                className={cn(
                  "pb-2 text-[14px] font-medium transition-colors border-b-2",
                  activeSection === item.id
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-0">
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
        {history && (
          <section id="history" className="scroll-mt-4">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
              Claim History
            </h2>
            {history}
          </section>
        )}
      </div>
    </div>
  );
}

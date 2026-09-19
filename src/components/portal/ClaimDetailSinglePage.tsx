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
  isLender,
}: Readonly<{
  loanDetails: ReactNode;
  statusAndQuery: ReactNode;
  documents: ReactNode;
  history: ReactNode;
  backLink?: ReactNode;
  showSectionNav?: boolean;
  isLender?: boolean;
}>) {
  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navItems = [
    { id: "loan-details", label: "Loan Details" },
    { id: "status-query", label: "Track Claim" },
  ];
  if (history && !isLender) {
    navItems.push({ id: "history", label: "Audit Trail" });
  }

  const [activeSection, setActiveSection] = useState<string>(isLender ? "status-query" : "loan-details");

  useEffect(() => {
    // Only use the intersection observer if this is NOT the lender tabbed view
    if (!showSectionNav || isLender) return;
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
  }, [showSectionNav, history, isLender]);

  return (
    <div className="flex flex-col">
      {/* ── Header row: Back link + Section Nav ── */}
      <div className="mb-4 flex shrink-0 flex-wrap items-end gap-8 border-b border-neutral-200 px-1 pt-1">
        {backLink && (
          <div className="pb-2">
            {backLink}
          </div>
        )}
        {showSectionNav && (
          <nav className="flex items-center gap-6">
            {navItems.map((item) => {
              if (isLender) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "pb-2 text-[14px] font-medium transition-colors border-b-2",
                      activeSection === item.id
                        ? "border-brand-primary text-brand-primary"
                        : "border-transparent text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    {item.label}
                  </button>
                );
              }
              
              return (
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
              );
            })}
          </nav>
        )}
      </div>

      {isLender ? (
        <div className="pr-2 pb-4">
          {activeSection === "loan-details" && (
            <section id="loan-details" className="mb-8">
              {loanDetails}
            </section>
          )}

          {activeSection === "status-query" && (
            <section id="status-query" className="mb-4">
              <div className="flex flex-col gap-4">
                {statusAndQuery}
                {documents}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="pr-2 pb-4">
          {/* Loan Details Section */}
          <section id="loan-details" className="scroll-mt-4 mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
              Loan Details
            </h2>
            {loanDetails}
          </section>

          {/* Status & Query Section */}
          <section id="status-query" className="scroll-mt-4 mb-4">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900 border-b border-neutral-200 pb-2">
              Track Claim
            </h2>
            <div className="flex flex-col gap-4">{statusAndQuery}</div>
          </section>

          {/* Documents Section */}
          <section id="documents" className="scroll-mt-4 mb-8">
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
      )}
    </div>
  );
}

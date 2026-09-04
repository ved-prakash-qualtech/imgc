"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The step switcher above an application set-up workspace.
 *
 * <p>Lifted from identity-portal-web-app's ApplicationConfigureWorkspace so the two consoles look
 * and behave identically — same markup, same classes, same collapse behaviour. Only the horizontal
 * branch is used by the Layout screen; the vertical one is kept because it is what the portal uses
 * for its template stage, and a screen here that needs it should not have to rewrite this.
 */
export type SplitItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

export function ConfigureSplit({
  items,
  value,
  onChange,
  ariaLabel,
  onNext,
  nextLabel = "Next",
  hideBottomNext = false,
  layout = "vertical",
  children,
}: {
  items: SplitItem[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  onNext?: () => void;
  nextLabel?: string;
  hideBottomNext?: boolean;
  layout?: "vertical" | "horizontal";
  children: ReactNode;
}) {
  const [sectionsOpen, setSectionsOpen] = useState(true);

  if (layout === "horizontal") {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="inline-flex h-9 items-center justify-center rounded-lg bg-muted/60 p-1"
          role="tablist"
          aria-label={ariaLabel}
        >
          {items.map(({ id, label, icon: Icon }) => {
            const isActive = id === value;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                role="tab"
                aria-selected={isActive}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  isActive
                    ? "bg-card text-foreground shadow"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
        <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-3 shadow-sm">
          <div className="min-w-0">{children}</div>
          {onNext && !hideBottomNext && (
            <div className="flex justify-end border-t border-border/60 pt-3">
              <Button size="sm" className="gap-1.5" onClick={onNext}>
                {nextLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-3 overflow-hidden">
      <aside
        className={`shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-150 ${
          sectionsOpen ? "w-56" : "w-10"
        }`}
      >
        <div className="flex min-h-9 items-center gap-1 border-b border-border/60 bg-muted/40 px-2 py-1.5">
          {sectionsOpen && (
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sections
            </span>
          )}
          <button
            type="button"
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground${
              !sectionsOpen ? " mx-auto" : ""
            }`}
            onClick={() => setSectionsOpen((v) => !v)}
            aria-label={sectionsOpen ? "Collapse sections" : "Expand sections"}
          >
            {sectionsOpen ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {sectionsOpen && (
          <div className="flex flex-col p-1">
            {items.map(({ id, label, icon: Icon, hint }) => {
              const active = value === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id)}
                  className={`flex flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition-colors ${
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    <Icon className="h-4 w-4" /> {label}
                  </span>
                  {hint && (
                    <span className="pl-[22px] text-[11px] text-muted-foreground">
                      {hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-3 shadow-sm">
        <div className="min-w-0">{children}</div>
        {onNext && !hideBottomNext && (
          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button size="sm" className="gap-1.5" onClick={onNext}>
              {nextLabel} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

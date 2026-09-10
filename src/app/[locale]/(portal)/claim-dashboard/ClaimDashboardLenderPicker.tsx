"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";

/**
 * The Claim Dashboard's lender lens — rendered into the hero band's top-right `action` slot, in
 * the same translucent-pill language the main Dashboard's own lender filter uses (it sits on the
 * dark gradient, not a white page, so it can't reuse the light filter pills the widgets below
 * use). Writes `?lender=`, which the page reads back to scope both widgets.
 */
export function ClaimDashboardLenderPicker({
  lenders,
  value,
}: Readonly<{
  lenders: { id: string; name: string }[];
  value: string | null;
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("lender", next);
    else params.delete("lender");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="relative">
      <select
        aria-label="Filter by lender"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-full border border-white/20 bg-white/10 py-0 pr-7 pl-3 text-[12.5px] font-medium text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/15 focus:border-white/40 focus:ring-2 focus:ring-white/20 [&>option]:text-neutral-900"
      >
        <option value="">Every Lender</option>
        {lenders.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/70" />
    </div>
  );
}

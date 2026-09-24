"use client";

import { useTransition, useState } from "react";
import { Panel } from "@/components/portal/Panel";
import { enterAdminContextAction } from "@/app/[locale]/(portal)/admin/workspace/actions";

export function AdminWorkspaceClient({
  orgs,
}: {
  orgs: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Please select a lender first.");
      return;
    }
    startTransition(async () => {
      const result = await enterAdminContextAction(selected);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <Panel className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Admin Workspace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select a lender to view their claims and accounts. This will establish
          a controlled session context.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-[13px] font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="lender-select"
            className="text-[13px] font-semibold text-slate-700"
          >
            Lender Organization
          </label>
          <div className="relative">
            <select
              id="lender-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={pending}
              className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-[14px] text-slate-900 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
            >
              <option value="" disabled>
                -- Select a lender --
              </option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={pending || !selected}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-[#f26e22] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#d85811] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Establishing Context..." : "Enter Lender Context"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

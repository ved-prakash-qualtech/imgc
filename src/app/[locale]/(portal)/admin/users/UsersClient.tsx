"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, DownloadIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { grantLenderAccessAction } from "@/app/[locale]/(portal)/admin/users/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationNumbers } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/twMergeUtils";
import type { LenderOrg } from "@/server/mock/types";
import type { UserRow } from "@/services/portal/users.server";

type SortKey = "name" | "email" | "role" | "organization" | "status";
type SortDirection = "asc" | "desc" | null;

const SortIcon = ({
  column,
  sortKey,
  sortDirection,
}: {
  column: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
}) => {
  if (sortKey !== column)
    return <ArrowUpDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-400" />;
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  );
};

const SortableTableHead = ({
  column,
  label,
  sortKey,
  sortDirection,
  onToggle,
  className,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onToggle: (k: SortKey) => void;
  className?: string;
}) => (
  <TableHead
    onClick={() => onToggle(column)}
    className={`h-8 cursor-pointer select-none px-1.5 text-[10.5px] transition-colors hover:bg-neutral-50 ${className || ""}`}
  >
    <div className="flex items-center">
      {label}
      <SortIcon column={column} sortKey={sortKey} sortDirection={sortDirection} />
    </div>
  </TableHead>
);

/** Escapes a value for one CSV field. */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadUsersCsv(users: UserRow[]): void {
  const headers = ["Name", "Email", "Role", "Organisation", "Sign-in"];
  const lines = users.map((u) =>
    [
      u.name,
      u.email,
      u.role,
      u.lenderOrgName ?? "IMGC",
      u.role === "IMGC" ? `Employee ID ${u.employeeId}` : "Email one-time code",
    ]
      .map(csvField)
      .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadOrgsCsv(orgs: LenderOrg[]): void {
  const headers = ["Organisation", "Email Domain", "Stakeholder Mailboxes"];
  const lines = orgs.map((o) =>
    [o.name, o.emailDomain, o.contactEmails.join("; ")].map(csvField).join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lender-organisations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function UsersClient({
  users,
  orgs,
}: Readonly<{ users: UserRow[]; orgs: LenderOrg[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDirection("asc");
        return;
      }
      if (sortDirection === "asc") {
        setSortDirection("desc");
        return;
      }
      setSortKey(null);
      setSortDirection(null);
    },
    [sortKey, sortDirection]
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setPage(1);
    },
    []
  );
  const handlePageSizeChange = useCallback((val: string | null) => {
    setPageSize(Number(val ?? "10"));
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = users;
    if (q) {
      result = users.filter((u) =>
        `${u.name} ${u.email} ${u.role} ${u.lenderOrgName ?? ""}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | number;
        let valB: string | number;
        switch (sortKey) {
          case "name": valA = a.name; valB = b.name; break;
          case "email": valA = a.email; valB = b.email; break;
          case "role": valA = a.role; valB = b.role; break;
          case "organization": valA = a.lenderOrgName ?? ""; valB = b.lenderOrgName ?? ""; break;
          case "status": valA = a.role === "IMGC" ? 0 : 1; valB = b.role === "IMGC" ? 0 : 1; break;
        }
        if (typeof valA === "string" && typeof valB === "string") {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [users, query, sortKey, sortDirection]);

  const pageCount = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentUsers = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExportUsers = useCallback(() => downloadUsersCsv(filtered), [filtered]);
  const handleExportOrgs = useCallback(() => downloadOrgsCsv(orgs), [orgs]);

  const onGrant = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      startTransition(async () => {
        const result = await grantLenderAccessAction(
          String(data.get("name") ?? ""),
          String(data.get("email") ?? ""),
          String(data.get("orgName") ?? "")
        );
        if (!result.ok) {
          toast.error(result.error ?? "Access could not be granted.");
          return;
        }
        toast.success("Lender access granted — a welcome message has been sent.");
        form.reset();
        setOpen(false);
        router.refresh();
      });
    },
    [router]
  );

  return (
    <div className="space-y-4">
      <Panel
        title="Lender access"
        description="A lender sees exactly the accounts whose lender matches the domain of the address granted here."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportUsers}>
              <DownloadIcon /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setOpen((v) => !v)}>
              <UserPlusIcon /> Grant access
            </Button>
          </div>
        }
      >
        {open && (
          <form
            onSubmit={onGrant}
            className="flex flex-wrap items-end gap-3 border-b border-neutral-100 bg-neutral-25 px-5 py-4"
          >
            <label className="min-w-[180px] flex-1">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Full name
              </span>
              <input
                name="name"
                required
                // The form opens on the user's own "Grant access" press, so focus follows
                // the action they took.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                placeholder="Arjun Mehta"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>
            <label className="min-w-[220px] flex-1">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Work email
              </span>
              <input
                name="email"
                type="email"
                required
                placeholder="name@lender.com"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>
            <label className="min-w-[180px] flex-1">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Lender name{" "}
                <span className="font-normal text-neutral-400">
                  (new domains only)
                </span>
              </span>
              <select
                name="orgName"
                className="h-9 w-full appearance-none rounded-lg border border-neutral-200 bg-white px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="">Select a lender...</option>
                <option value="HDFC Bank">HDFC Bank</option>
                <option value="ICICI Bank">ICICI Bank</option>
                <option value="Axis Bank">Axis Bank</option>
                <option value="Kotak Bank">Kotak Bank</option>
                <option value="Yes Bank">Yes Bank</option>
                <option value="Sunrise Housing Finance">Sunrise Housing Finance</option>
                <option value="PQR Finance">PQR Finance</option>
              </select>
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              Grant access
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </form>
        )}

        <div className="border-b border-neutral-100 px-4 py-2.5">
          <div className="relative w-fit">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={handleQueryChange}
              placeholder="Name, email, organisation…"
              aria-label="Search users"
              className="h-8 w-[260px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="name" label="Name" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="email" label="Email" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="role" label="Role" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="organization" label="Organisation" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
                <SortableTableHead column="status" label="Sign-in" sortKey={sortKey} sortDirection={sortDirection} onToggle={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-[13px] text-neutral-500">
                    No users match your search.
                  </TableCell>
                </TableRow>
              ) : (
                currentUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="px-1.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-neutral-950">
                      {u.name}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-600">
                      {u.email}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
                          u.role === "IMGC"
                            ? "bg-brand-muted text-brand-dark"
                            : "bg-warning/15 text-warning"
                        )}
                      >
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[12px] whitespace-nowrap text-neutral-600">
                      {u.lenderOrgName ?? "IMGC"}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5 text-[11.5px] whitespace-nowrap text-neutral-500">
                      {u.role === "IMGC"
                        ? `Employee ID ${u.employeeId}`
                        : "Email one-time code"}
                    </TableCell>
                  </TableRow>
                )))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-25 px-5 py-2">
          <div className="flex items-center gap-3 text-[13px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger size="sm" className="h-8 w-[70px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="hidden sm:inline">
              Total {filtered.length} user{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] text-neutral-500 sm:inline">
              Page {currentPage} of {pageCount}
            </span>
            <PaginationNumbers
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Lender organisations"
        description="Scope is keyed on the email domain."
        actions={
          <Button variant="outline" size="sm" onClick={handleExportOrgs}>
            <DownloadIcon /> Export CSV
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-1.5 text-[10.5px]">Organisation</TableHead>
                <TableHead className="h-8 px-1.5 text-[10.5px]">Email domain</TableHead>
                <TableHead className="h-8 px-1.5 text-[10.5px]">Stakeholder mailboxes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="px-1.5 py-1.5 text-[12px] font-medium whitespace-nowrap text-neutral-950">
                    {o.name}
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] whitespace-nowrap">
                      @{o.emailDomain}
                    </code>
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5 text-[11.5px] text-neutral-600">
                    {o.contactEmails.join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}

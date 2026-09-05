"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, SearchIcon, UserPlusIcon } from "lucide-react";
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
    if (!q) return users;
    return users.filter((u) =>
      `${u.name} ${u.email} ${u.role} ${u.lenderOrgName ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, query]);

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
              <input
                name="orgName"
                placeholder="Acme Bank"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Sign-in</TableHead>
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
                  <TableCell className="font-medium text-neutral-950">
                    {u.name}
                  </TableCell>
                  <TableCell className="text-neutral-600">{u.email}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                        u.role === "IMGC"
                          ? "bg-brand-muted text-brand-dark"
                          : "bg-warning/15 text-warning"
                      )}
                    >
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-neutral-600">
                    {u.lenderOrgName ?? "IMGC"}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-500">
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
                <TableHead>Organisation</TableHead>
                <TableHead>Email domain</TableHead>
                <TableHead>Stakeholder mailboxes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium text-neutral-950">
                    {o.name}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[12px]">
                      @{o.emailDomain}
                    </code>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-600">
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

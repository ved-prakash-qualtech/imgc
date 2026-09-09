"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  Building2Icon,
  ChevronDownIcon,
  DownloadIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createLenderOrgAction,
  grantLenderAccessAction,
  updateLenderOrgAction,
} from "@/app/[locale]/(portal)/admin/users/actions";
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
/** The organisations table's own sortable columns — "Actions" is not one. */
type OrgSortKey = "name" | "emailDomain" | "mailboxes" | "users";
type SortDirection = "asc" | "desc" | null;

// Generic over the key type so the users table and the organisations table sort through the same
// two components rather than a second, drifting copy of them.
function SortIcon<K extends string>({
  column,
  sortKey,
  sortDirection,
}: {
  column: K;
  sortKey: K | null;
  sortDirection: SortDirection;
}) {
  if (sortKey !== column)
    return <ArrowUpDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-400" />;
  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  ) : (
    <ArrowDownIcon className="ml-0.5 size-3 shrink-0 text-neutral-800" />
  );
}

function SortableTableHead<K extends string>({
  column,
  label,
  sortKey,
  sortDirection,
  onToggle,
  className,
}: {
  column: K;
  label: string;
  sortKey: K | null;
  sortDirection: SortDirection;
  onToggle: (k: K) => void;
  className?: string;
}) {
  return (
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
}

/** Which `?role=` values the band's tiles may deep-link with — anything else falls back to
 *  "ALL" rather than silently filtering the table down to nothing. */
function roleFromParam(value: string | null): "ALL" | "LENDER" | "IMGC" {
  return value === "LENDER" || value === "IMGC" ? value : "ALL";
}

/** Likewise for `?orgs=` — see `orgFilter`. */
function orgFilterFromParam(value: string | null): "ALL" | "AWAITING" | "ACTIVE" {
  return value === "AWAITING" || value === "ACTIVE" ? value : "ALL";
}

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

/** Two initials for the organisation avatar — "Metro Housing Finance" becomes "MH". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * One organisation row. Split out so the Edit button gets a stable, row-scoped handler instead
 * of a closure rebuilt for every row on every render of the table.
 */
function OrgRow({
  org,
  userCount,
  onEdit,
}: Readonly<{
  org: LenderOrg;
  userCount: number;
  onEdit: (next: { mode: "edit"; org: LenderOrg }) => void;
}>) {
  const handleEdit = useCallback(
    () => onEdit({ mode: "edit", org }),
    [onEdit, org]
  );
  return (
    <TableRow>
      <TableCell className="px-1.5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-light text-[10px] font-bold text-brand-dark">
            {initialsOf(org.name)}
          </span>
          <span className="text-[12px] font-medium whitespace-nowrap text-neutral-950">
            {org.name}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] whitespace-nowrap">
          @{org.emailDomain}
        </code>
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-[11.5px] text-neutral-600">
        {org.contactEmails.length ? (
          <div className="flex flex-wrap gap-1">
            {org.contactEmails.map((e) => (
              <span
                key={e}
                className="rounded-full bg-neutral-50 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-neutral-600 ring-1 ring-neutral-200"
              >
                {e}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-neutral-400">None yet</span>
        )}
      </TableCell>
      <TableCell className="px-1.5 py-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
            userCount === 0
              ? "bg-neutral-100 text-neutral-500"
              : "bg-info/12 text-info"
          )}
          title={
            userCount === 0
              ? "No one from this organisation can sign in yet"
              : `${userCount} lender user(s)`
          }
        >
          <UsersIcon className="size-3" />
          {userCount}
        </span>
      </TableCell>
      <TableCell className="px-1.5 py-1.5 text-right">
        <Button variant="outline" size="xs" onClick={handleEdit}>
          <PencilIcon /> Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Add or correct an organisation — one form, two modes.
 *
 * The domain is editable only while creating. Once an organisation exists it is the key every
 * account, claim and user is scoped through, so changing it would silently re-point a whole book
 * of business at a different lender; the field is shown, locked, and says why (the server
 * enforces this too — `updateLenderOrg` never reads a domain).
 */
function OrgForm({
  mode,
  org,
  pending,
  onSubmit,
  onCancel,
}: Readonly<{
  mode: "create" | "edit";
  org?: LenderOrg;
  pending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}>) {
  const editing = mode === "edit";
  return (
    <form
      // Remounts when the target changes, so `defaultValue` re-seeds from the row being edited
      // instead of keeping whatever the previously-open row put there.
      key={org?.id ?? "create"}
      onSubmit={onSubmit}
      className="border-b border-neutral-100 bg-neutral-25 px-5 py-4"
    >
      <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-neutral-800">
        <Building2Icon className="size-3.5 text-brand-primary" />
        {editing ? `Edit ${org?.name}` : "Add a lender organisation"}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
            Organisation name
          </span>
          <input
            name="orgName"
            required
            defaultValue={org?.name ?? ""}
            // The form opens on the user's own button press, so focus follows their action.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder="Bajaj Housing Finance"
            className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </label>
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 flex items-center gap-1 text-[12.5px] font-medium text-neutral-700">
            Email domain
            {editing && <LockIcon className="size-3 text-neutral-400" />}
          </span>
          <input
            name="emailDomain"
            required={!editing}
            disabled={editing}
            defaultValue={org?.emailDomain ?? ""}
            placeholder="bajajhousing.com"
            className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
          />
        </label>
        <label className="min-w-[240px] flex-[2]">
          <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
            Stakeholder mailboxes{" "}
            <span className="font-normal text-neutral-400">
              (comma separated, optional)
            </span>
          </span>
          <input
            name="contactEmails"
            defaultValue={org?.contactEmails.join(", ") ?? ""}
            placeholder="claims@bajajhousing.com, ops@bajajhousing.com"
            className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {editing ? "Save changes" : "Add organisation"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="mt-2 text-[11.5px] text-neutral-500">
        {editing
          ? "The domain cannot be changed — it is what scopes this lender's accounts, claims and users."
          : "Anyone later granted access at this domain is scoped to this organisation automatically."}
      </p>
    </form>
  );
}

export function UsersClient({
  users,
  orgs,
}: Readonly<{ users: UserRow[]; orgs: LenderOrg[] }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  /**
   * This table lists everyone who can sign in — lender users *and* IMGC staff — while the band
   * above counts the two separately. Read together, "Lender Users 22" over "Total 25 users" looks
   * like a contradiction when it is really 22 + 3 IMGC staff. Neither number was wrong, so the
   * fix is to say which is which rather than to change one: this filter lets the 22 be isolated,
   * and the footer names the split.
   */
  const [roleFilter, setRoleFilter] = useState<"ALL" | "LENDER" | "IMGC">(() =>
    roleFromParam(searchParams.get("role"))
  );
  const lenderUserCount = users.filter((u) => u.role === "LENDER").length;
  const imgcUserCount = users.filter((u) => u.role === "IMGC").length;

  function handleRoleFilterChange(v: string | null) {
    setRoleFilter((v as "ALL" | "LENDER" | "IMGC" | null) ?? "ALL");
    setPage(1);
  }

  // A KPI tile in the band navigates client-side to this same route with new params, so this
  // component never remounts and the lazy `useState` initialisers above only ever ran once. Both
  // filters are therefore re-synced during render when their param changes — React's own
  // "adjust state when a prop changes" pattern, the same one EligibleCasesClient uses for the
  // Claims Overview tiles. Without it, the URL updates and the tables keep the old filter.
  const roleParam = searchParams.get("role");
  const [prevRoleParam, setPrevRoleParam] = useState(roleParam);
  if (roleParam !== prevRoleParam) {
    setPrevRoleParam(roleParam);
    setRoleFilter(roleFromParam(roleParam));
    setPage(1);
  }
  // The matching `?orgs=` re-sync lives further down, immediately after the organisation state
  // it writes to — running it here would touch those setters before their `useState` has been
  // reached in this render pass.
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
    if (roleFilter !== "ALL") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (q) {
      result = result.filter((u) =>
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
  }, [users, query, roleFilter, sortKey, sortDirection]);

  const pageCount = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, pageCount);
  const currentUsers = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleExportUsers = useCallback(() => downloadUsersCsv(filtered), [filtered]);

  /* ── granting access ─────────────────────────────────────────────── */

  /** The email is controlled purely so the organisation it resolves to can be shown while it is
   *  being typed. Every other field on that form stays uncontrolled and is read from FormData. */
  const [grantEmail, setGrantEmail] = useState("");

  /** Same normalisation `domainOf` applies on the server, so what the form claims will happen
   *  and what actually happens cannot drift apart. */
  const grantDomain = grantEmail.trim().toLowerCase().split("@")[1]?.trim() ?? "";
  const matchedOrg = grantDomain
    ? (orgs.find((o) => o.emailDomain === grantDomain) ?? null)
    : null;

  function handleGrantEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setGrantEmail(e.target.value);
  }
  function closeGrantForm() {
    setOpen(false);
    setGrantEmail("");
  }

  /* ── lender organisations ────────────────────────────────────────── */

  /** `null` = the form is closed. Otherwise it is open in one of its two modes; `org` carries the
   *  row being corrected, so one form serves both without a second copy of the markup. */
  const [orgForm, setOrgForm] = useState<
    { mode: "create" } | { mode: "edit"; org: LenderOrg } | null
  >(null);
  const [orgQuery, setOrgQuery] = useState("");

  /** How many users each organisation currently has — the answer to "is this org actually in
   *  use, or did a typo create it?", which the table could not previously show. */
  const usersByOrg = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      if (!u.lenderOrgId) continue;
      counts.set(u.lenderOrgId, (counts.get(u.lenderOrgId) ?? 0) + 1);
    }
    return counts;
  }, [users]);

  /** "Awaiting first user" is the state Option B made reachable — an organisation onboarded
   *  before anyone from it has a login — so it is worth being able to filter down to it. */
  const [orgFilter, setOrgFilter] = useState<"ALL" | "AWAITING" | "ACTIVE">(() =>
    orgFilterFromParam(searchParams.get("orgs"))
  );
  const [orgSortKey, setOrgSortKey] = useState<OrgSortKey | null>(null);
  const [orgSortDirection, setOrgSortDirection] = useState<SortDirection>(null);

  function toggleOrgSort(key: OrgSortKey) {
    if (orgSortKey !== key) {
      setOrgSortKey(key);
      setOrgSortDirection("asc");
      return;
    }
    if (orgSortDirection === "asc") {
      setOrgSortDirection("desc");
      return;
    }
    setOrgSortKey(null);
    setOrgSortDirection(null);
  }

  function handleOrgFilterChange(v: string) {
    setOrgFilter((v as "ALL" | "AWAITING" | "ACTIVE") ?? "ALL");
    setOrgPage(1);
  }

  const visibleOrgs = useMemo(() => {
    const q = orgQuery.trim().toLowerCase();
    let result = orgs;

    if (orgFilter !== "ALL") {
      const awaiting = orgFilter === "AWAITING";
      result = result.filter(
        (o) => ((usersByOrg.get(o.id) ?? 0) === 0) === awaiting
      );
    }
    if (q) {
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.emailDomain.toLowerCase().includes(q) ||
          o.contactEmails.some((e) => e.toLowerCase().includes(q))
      );
    }

    if (orgSortKey && orgSortDirection) {
      result = [...result].sort((a, b) => {
        let valA: string | number;
        let valB: string | number;
        switch (orgSortKey) {
          case "name":
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case "emailDomain":
            valA = a.emailDomain.toLowerCase();
            valB = b.emailDomain.toLowerCase();
            break;
          case "mailboxes":
            valA = a.contactEmails.length;
            valB = b.contactEmails.length;
            break;
          case "users":
            valA = usersByOrg.get(a.id) ?? 0;
            valB = usersByOrg.get(b.id) ?? 0;
            break;
        }
        if (valA < valB) return orgSortDirection === "asc" ? -1 : 1;
        if (valA > valB) return orgSortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [orgs, orgQuery, orgFilter, orgSortKey, orgSortDirection, usersByOrg]);

  // Paged the same way the users table above is, rather than scrolled — one pagination idiom
  // across the page (and the app), so neither table asks the reader to learn a second one.
  const [orgPage, setOrgPage] = useState(1);
  const [orgPageSize, setOrgPageSize] = useState(6);
  const orgPageCount = Math.ceil(visibleOrgs.length / orgPageSize) || 1;
  const currentOrgPage = Math.min(orgPage, orgPageCount);
  const currentOrgs = visibleOrgs.slice(
    (currentOrgPage - 1) * orgPageSize,
    currentOrgPage * orgPageSize
  );

  function handleOrgPageSizeChange(val: string | null) {
    setOrgPageSize(Number(val ?? "6"));
    setOrgPage(1);
  }

  /** The `?orgs=` half of the band's deep-linking — see the `?role=` re-sync above. */
  const orgsParam = searchParams.get("orgs");
  const [prevOrgsParam, setPrevOrgsParam] = useState(orgsParam);
  if (orgsParam !== prevOrgsParam) {
    setPrevOrgsParam(orgsParam);
    setOrgFilter(orgFilterFromParam(orgsParam));
    setOrgPage(1);
  }

  const handleExportOrgs = useCallback(
    () => downloadOrgsCsv(visibleOrgs),
    [visibleOrgs]
  );

  // Plain functions, not `useCallback`: this project builds with the React Compiler
  // (`reactCompiler: true` in next.config.ts), which memoizes these automatically and reports a
  // hard error when a hand-written `useCallback` around them cannot be preserved.
  function openCreateOrg() {
    setOrgForm((v) => (v?.mode === "create" ? null : { mode: "create" }));
  }
  function closeOrgForm() {
    setOrgForm(null);
  }
  function handleOrgQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setOrgQuery(e.target.value);
    setOrgPage(1);
  }

  function onSubmitOrg(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgForm) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("orgName") ?? "");
    const mailboxes = String(data.get("contactEmails") ?? "");
    const creating = orgForm.mode === "create";
    const orgId = orgForm.mode === "edit" ? orgForm.org.id : "";
    startTransition(async () => {
      const result = creating
        ? await createLenderOrgAction(
            name,
            String(data.get("emailDomain") ?? ""),
            mailboxes
          )
        : await updateLenderOrgAction(orgId, name, mailboxes);
      if (!result.ok) {
        toast.error(result.error ?? "That could not be saved.");
        return;
      }
      toast.success(
        creating
          ? `"${name.trim()}" added — lenders on that domain will scope to it.`
          : "Organisation updated."
      );
      form.reset();
      setOrgForm(null);
      router.refresh();
    });
  }

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
        // `form.reset()` does not clear a controlled input, so the email — and the organisation
        // resolved from it — has to be cleared explicitly, or the next open starts pre-filled.
        setGrantEmail("");
        setOpen(false);
        router.refresh();
      });
    },
    [router]
  );

  return (
    <div className="space-y-4">
      <Panel
        id="users"
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
                value={grantEmail}
                onChange={handleGrantEmailChange}
                placeholder="name@lender.com"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </label>

            {/* Not a list of lenders to choose from: the domain of the address above already
                decides the organisation (`createLenderAccess` resolves it that way, and ignores
                any name given for a domain it already knows). So this shows the resolution
                rather than inviting a choice that would be discarded — and only asks for a name
                in the one case the server actually uses it, a domain nobody has registered. */}
            <div className="min-w-[200px] flex-1">
              <span className="mb-1 block text-[12.5px] font-medium text-neutral-700">
                Lender organisation
              </span>
              {matchedOrg ? (
                <div className="flex h-9 items-center gap-1.5 rounded-lg border border-success-200 bg-success-50 px-3 text-[12.5px] font-medium text-success-700">
                  <Building2Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{matchedOrg.name}</span>
                </div>
              ) : grantDomain ? (
                <input
                  name="orgName"
                  required
                  placeholder="Bajaj Housing Finance"
                  className="h-9 w-full rounded-lg border border-warning/40 bg-warning/5 px-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              ) : (
                <div className="flex h-9 items-center rounded-lg border border-dashed border-neutral-200 px-3 text-[12.5px] text-neutral-400">
                  Enter a work email first
                </div>
              )}
              <p className="mt-1 text-[11px] text-neutral-500">
                {matchedOrg
                  ? `Resolved from @${grantDomain} — they will see only this lender's accounts.`
                  : grantDomain
                    ? `No organisation uses @${grantDomain} yet — this creates one.`
                    : "The email domain decides which lender they are scoped to."}
              </p>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Grant access
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={closeGrantForm}
            >
              Cancel
            </Button>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
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
          <div className="relative">
            <select
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
              className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="ALL">All roles</option>
              <option value="LENDER">Lender users</option>
              <option value="IMGC">IMGC staff</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
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
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Spells out the split, so this total can never look like it disagrees with the
                "Lender Users" tile in the band above — it counts lenders only, this counts
                everyone who can sign in. */}
            <span className="hidden sm:inline">
              Total {filtered.length} user{filtered.length === 1 ? "" : "s"}
              {roleFilter === "ALL" && !query.trim() && (
                <span className="text-neutral-400">
                  {" "}
                  · {lenderUserCount} lender · {imgcUserCount} IMGC staff
                </span>
              )}
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
        id="organisations"
        title="Lender organisations"
        description="Scope is keyed on the email domain — every account, claim and user a lender sees follows from it."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportOrgs}>
              <DownloadIcon /> Export CSV
            </Button>
            <Button size="sm" onClick={openCreateOrg}>
              <PlusIcon /> Add organisation
            </Button>
          </div>
        }
      >
        {orgForm && (
          <OrgForm
            mode={orgForm.mode}
            org={orgForm.mode === "edit" ? orgForm.org : undefined}
            pending={pending}
            onSubmit={onSubmitOrg}
            onCancel={closeOrgForm}
          />
        )}

        {/* Same shape as the users table's own search row above — one search affordance on the
            page, not two that look different. The row count it used to carry now lives in the
            footer, where the users table already puts it. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
          <div className="relative w-fit">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={orgQuery}
              onChange={handleOrgQueryChange}
              placeholder="Organisation, domain, mailbox…"
              aria-label="Search lender organisations"
              className="h-8 w-[260px] rounded-full border border-neutral-200 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <div className="relative">
            <select
              aria-label="Access state"
              value={orgFilter}
              onChange={(e) => handleOrgFilterChange(e.target.value)}
              className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-8 text-center text-[12.5px] font-medium text-neutral-700 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="ALL">All organisations</option>
              <option value="ACTIVE">Has users</option>
              <option value="AWAITING">Awaiting first user</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  column="name"
                  label="Organisation"
                  sortKey={orgSortKey}
                  sortDirection={orgSortDirection}
                  onToggle={toggleOrgSort}
                />
                <SortableTableHead
                  column="emailDomain"
                  label="Email domain"
                  sortKey={orgSortKey}
                  sortDirection={orgSortDirection}
                  onToggle={toggleOrgSort}
                />
                <SortableTableHead
                  column="mailboxes"
                  label="Stakeholder mailboxes"
                  sortKey={orgSortKey}
                  sortDirection={orgSortDirection}
                  onToggle={toggleOrgSort}
                />
                <SortableTableHead
                  column="users"
                  label="Users"
                  sortKey={orgSortKey}
                  sortDirection={orgSortDirection}
                  onToggle={toggleOrgSort}
                />
                <TableHead className="h-8 px-1.5 text-right text-[10.5px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleOrgs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-[13px] text-neutral-500"
                  >
                    {orgs.length === 0
                      ? "No lender organisations yet — add one to start onboarding."
                      : "No organisation matches your search."}
                  </TableCell>
                </TableRow>
              ) : (
                currentOrgs.map((o) => (
                  <OrgRow
                    key={o.id}
                    org={o}
                    userCount={usersByOrg.get(o.id) ?? 0}
                    onEdit={setOrgForm}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-25 px-5 py-2">
          <div className="flex items-center gap-3 text-[13px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(orgPageSize)}
                onValueChange={handleOrgPageSizeChange}
              >
                <SelectTrigger size="sm" className="h-8 w-[70px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="hidden sm:inline">
              Total {visibleOrgs.length} organisation
              {visibleOrgs.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] text-neutral-500 sm:inline">
              Page {currentOrgPage} of {orgPageCount}
            </span>
            <PaginationNumbers
              page={currentOrgPage}
              pageCount={orgPageCount}
              onPageChange={setOrgPage}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}

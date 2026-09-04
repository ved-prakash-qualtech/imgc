"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { grantLenderAccessAction } from "@/app/[locale]/(portal)/admin/users/actions";
import { Panel } from "@/components/portal/Panel";
import { Button } from "@/components/ui/button";
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

export function UsersClient({
  users,
  orgs,
}: Readonly<{ users: UserRow[]; orgs: LenderOrg[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

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
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            <UserPlusIcon /> Grant access
          </Button>
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

        <div className="overflow-x-auto">
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
              {users.map((u) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Panel title="Lender organisations" description="Scope is keyed on the email domain.">
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

import "server-only";

import { readDb, writeDb } from "@/server/mock/db";
import { newId, nowIso } from "@/server/mock/ids";
import { verifyPassword } from "@/lib/auth/password";
import { sendMail } from "@/server/mock/mailer";
import type { AppSession } from "@/lib/auth/appSession";
import type { LenderOrg, User } from "@/server/mock/types";

export interface UserRow extends User {
  lenderOrgName?: string;
}

export function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export async function findByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const db = await readDb();
  return db.users.find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export async function findByEmployeeId(employeeId: string): Promise<User | null> {
  const normalized = employeeId.trim().toUpperCase();
  const db = await readDb();
  return (
    db.users.find((u) => (u.employeeId ?? "").toUpperCase() === normalized) ?? null
  );
}

/** IMGC staff sign-in: Employee ID + password. */
export async function authenticateImgc(
  employeeId: string,
  password: string
): Promise<User | null> {
  const user = await findByEmployeeId(employeeId);
  if (!user || user.role !== "IMGC" || !user.passwordHash) return null;
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

export async function getLenderOrgById(id: string | undefined): Promise<LenderOrg | null> {
  if (!id) return null;
  const db = await readDb();
  return db.lenderOrgs.find((o) => o.id === id) ?? null;
}

export interface AssignedOfficer {
  name: string;
  email: string;
  phone?: string;
}

/**
 * The IMGC officer a lender's Help & Assistance card points to.
 *
 * Cases are assigned per account, not per lender, so there is no single field holding "this
 * org's officer" — instead this picks whoever is assigned to the most of the lender's accounts,
 * which is the person actually handling most of their open work. Ties break on account id order,
 * which is stable rather than meaningful; a lender with no assigned cases yet gets no officer at
 * all, so the caller can fall back to a general desk instead of naming someone with nothing to
 * do with them.
 */
export async function getAssignedOfficer(
  session: AppSession
): Promise<AssignedOfficer | null> {
  if (session.role !== "LENDER" || !session.lenderOrgId) return null;

  const db = await readDb();
  const counts = new Map<string, number>();
  for (const account of db.accounts) {
    if (account.lenderOrgId !== session.lenderOrgId || !account.assignedUserId) continue;
    counts.set(account.assignedUserId, (counts.get(account.assignedUserId) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const [topUserId] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const officer = db.users.find((u) => u.id === topUserId);
  if (!officer) return null;

  return { name: officer.name, email: officer.email, phone: officer.phone };
}

export async function listUsers(session: AppSession): Promise<UserRow[]> {
  const db = await readDb();
  const visible =
    session.role === "IMGC"
      ? db.users
      : db.users.filter((u) => u.lenderOrgId === session.lenderOrgId);
  return visible.map((u) => ({
    ...u,
    lenderOrgName: db.lenderOrgs.find((o) => o.id === u.lenderOrgId)?.name,
  }));
}

export async function listLenderOrgs(): Promise<LenderOrg[]> {
  const db = await readDb();
  return db.lenderOrgs;
}

/**
 * BRD: initial lender access is granted by IMGC. The lender's org — and therefore what they can
 * see — follows from the domain of the email address granted here.
 */
export async function createLenderAccess(
  session: AppSession,
  input: { name: string; email: string; orgName?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (session.role !== "IMGC") return { ok: false, error: "IMGC only." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Give the user a name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That is not a valid email address." };
  }

  const domain = domainOf(email);
  if (!domain) return { ok: false, error: "That email has no domain." };

  const outcome = await writeDb((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false as const, error: "That email already has access." };
    }
    let org = db.lenderOrgs.find((o) => o.emailDomain === domain);
    if (!org) {
      org = {
        id: newId("org"),
        name: input.orgName?.trim() || domain,
        emailDomain: domain,
        contactEmails: [email],
      };
      db.lenderOrgs.push(org);
    } else if (!org.contactEmails.includes(email)) {
      org.contactEmails.push(email);
    }
    db.users.push({
      id: newId("usr"),
      role: "LENDER",
      name,
      email,
      lenderOrgId: org.id,
      createdAt: nowIso(),
      createdBy: session.userId,
    });
    return { ok: true as const, orgName: org.name };
  });

  if (!outcome.ok) return outcome;

  await sendMail({
    to: [email],
    subject: "Your IMGC Lender Portal access is ready",
    body: `${name}, you have been granted access to the IMGC Lender Portal for ${outcome.orgName}. Sign in with this email address — a one-time code will be sent to you each time.`,
    event: "LENDER_ACCESS_GRANTED",
  });
  return { ok: true };
}

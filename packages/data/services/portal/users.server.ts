// `"server-only"` below throws at build time if this module reaches a client bundle, so it
// can never run in a browser — this rule is flagging a local identifier (`name`) that
// happens to share a name with a global browser API, not an actual browser-api call.
/* eslint-disable use-client/browser-api */

import "server-only";

import {
  fail,
  type ServerErrorCode,
  type ServerErrorParams,
} from "@imgc/config/errorCodes";

import { readDb, writeDb } from "@imgc/data/server/mock/db";
import { newId, nowIso } from "@imgc/data/server/mock/ids";
import { verifyPassword } from "@imgc/lib/auth/password";
import { sendMail } from "@imgc/data/server/mock/mailer";
import type { AppSession } from "@imgc/lib/auth/appSession";
import type { LenderOrg, User } from "@imgc/types/domain";

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

export async function findByEmployeeId(
  employeeId: string
): Promise<User | null> {
  const normalized = employeeId.trim().toUpperCase();
  const db = await readDb();
  return (
    db.users.find((u) => (u.employeeId ?? "").toUpperCase() === normalized) ??
    null
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

export async function getUserById(
  id: string | undefined
): Promise<User | null> {
  if (!id) return null;
  const db = await readDb();
  return db.users.find((u) => u.id === id) ?? null;
}

export async function getLenderOrgById(
  id: string | undefined
): Promise<LenderOrg | null> {
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
    if (account.lenderOrgId !== session.lenderOrgId || !account.assignedUserId)
      continue;
    counts.set(
      account.assignedUserId,
      (counts.get(account.assignedUserId) ?? 0) + 1
    );
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

/** A domain is the scoping key, so it has to be stored in one canonical shape — lower-cased and
 *  without the "@" a user naturally types in front of it. */
function normaliseDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

/** Splits the stakeholder-mailbox textarea/CSV field into addresses, dropping blanks. */
function parseMailboxes(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

/**
 * A domain as `label(.label)+`, checked one label at a time rather than with a single nested
 * regex. The obvious pattern for this — `^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.…)+$` — nests a
 * quantifier inside a quantified group, which backtracks catastrophically on a long
 * near-match; this input comes from a form field, so it is worth not writing that.
 */
// `-+` and `[a-z0-9]+` match disjoint character sets, so the outer `*` has no ambiguity to
// backtrack over, and `isValidDomain` bounds the length before this ever runs.
// eslint-disable-next-line security/detect-unsafe-regex
const DOMAIN_LABEL_RE = /^[a-z0-9]+(-+[a-z0-9]+)*$/;

function isValidDomain(domain: string): boolean {
  if (domain.length > 253) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every(
    (l) => l.length > 0 && l.length <= 63 && DOMAIN_LABEL_RE.test(l)
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface LenderOrgInput {
  name: string;
  emailDomain: string;
  contactEmails: string;
}

/**
 * Create a lender organisation directly, before anyone from it has a login.
 *
 * Onboarding a lender is a step of its own — it happens before user accounts exist — so an org
 * should not have to be conjured as a side effect of granting the first user access
 * (`createLenderAccess` still does that for a domain nobody has registered yet, unchanged). The
 * email domain remains the scoping key and is validated for uniqueness here rather than silently
 * folding into whichever org already claimed it.
 */
export async function createLenderOrg(
  session: AppSession,
  input: LenderOrgInput
): Promise<{
  ok: boolean;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
}> {
  if (session.role !== "IMGC") return fail("IMGC_ONLY");

  const name = input.name.trim();
  const emailDomain = normaliseDomain(input.emailDomain);
  const contactEmails = parseMailboxes(input.contactEmails);

  if (!name) return fail("ORG_NAME_REQUIRED");
  if (!emailDomain) return fail("ORG_DOMAIN_REQUIRED");
  if (!isValidDomain(emailDomain)) {
    return fail("DOMAIN_INVALID", { domain: emailDomain });
  }
  const badEmail = contactEmails.find((e) => !EMAIL_RE.test(e));
  if (badEmail) return fail("EMAIL_INVALID_VALUE", { email: badEmail });

  return writeDb((db) => {
    const clash = db.lenderOrgs.find((o) => o.emailDomain === emailDomain);
    if (clash) {
      return fail("DOMAIN_TAKEN", { domain: emailDomain, org: clash.name });
    }
    if (
      db.lenderOrgs.some((o) => o.name.toLowerCase() === name.toLowerCase())
    ) {
      return fail("ORG_NAME_TAKEN", { name });
    }
    db.lenderOrgs.push({ id: newId("org"), name, emailDomain, contactEmails });
    return { ok: true as const };
  });
}

/**
 * Rename an organisation or change who its stakeholder mail goes to.
 *
 * The email domain is deliberately not editable: it is the key every account, claim and user is
 * scoped through, so changing it would silently re-point an entire book of business at a
 * different organisation. Retiring a domain is a migration, not a field edit.
 */
export async function updateLenderOrg(
  session: AppSession,
  orgId: string,
  input: { name: string; contactEmails: string }
): Promise<{
  ok: boolean;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
}> {
  if (session.role !== "IMGC") return fail("IMGC_ONLY");

  const name = input.name.trim();
  const contactEmails = parseMailboxes(input.contactEmails);
  if (!name) return fail("ORG_NAME_REQUIRED");
  const badEmail = contactEmails.find((e) => !EMAIL_RE.test(e));
  if (badEmail) return fail("EMAIL_INVALID_VALUE", { email: badEmail });

  return writeDb((db) => {
    const org = db.lenderOrgs.find((o) => o.id === orgId);
    if (!org) return fail("ORG_NOT_FOUND");
    const clash = db.lenderOrgs.find(
      (o) => o.id !== orgId && o.name.toLowerCase() === name.toLowerCase()
    );
    if (clash) {
      return fail("ORG_NAME_TAKEN", { name });
    }
    org.name = name;
    org.contactEmails = contactEmails;
    return { ok: true as const };
  });
}

/**
 * BRD: initial lender access is granted by IMGC. The lender's org — and therefore what they can
 * see — follows from the domain of the email address granted here.
 */
export async function createLenderAccess(
  session: AppSession,
  input: { name: string; email: string; orgName?: string }
): Promise<{
  ok: boolean;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
}> {
  if (session.role !== "IMGC") return fail("IMGC_ONLY");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return fail("USER_NAME_REQUIRED");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail("EMAIL_INVALID");
  }

  const domain = domainOf(email);
  if (!domain) return fail("EMAIL_NO_DOMAIN");

  const outcome = await writeDb((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return fail("EMAIL_ALREADY_HAS_ACCESS");
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

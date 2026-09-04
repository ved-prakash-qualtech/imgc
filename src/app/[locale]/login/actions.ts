"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/route";
import { createSession } from "@/lib/auth/appSession";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import {
  authenticateImgc,
  findByEmail,
  findByEmployeeId,
  getLenderOrgById,
} from "@/services/portal/users.server";
import type { Role } from "@/server/mock/types";

/**
 * Sign-in for the two roles the BRD names.
 *
 *  - IMGC staff: Employee ID + password.
 *  - Lender: email address + a one-time code mailed to it. Which accounts they then see follows
 *    from the domain of that verified address, never from anything the browser sends.
 *
 * There is no real mail delivery in the prototype, so in development the issued code is returned
 * to the page (and written to the server console / Notifications outbox).
 */

const isDev = process.env.NODE_ENV !== "production";

/** Only ever redirect within this app. */
function safeReturnTo(returnTo: string | undefined): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return ROUTES.dashboard;
  }
  return returnTo;
}

export type StartLoginResult =
  | { mode: "PASSWORD"; employeeId: string; name: string }
  | { mode: "OTP"; email: string; devCode?: string }
  | { mode: "ERROR"; error: string };

/** Decide which of the two flows the identifier belongs to, and begin it. */
export async function startLoginAction(
  identifierRaw: string
): Promise<StartLoginResult> {
  const identifier = identifierRaw.trim();
  if (!identifier) {
    return { mode: "ERROR", error: "Enter your Employee ID or email address." };
  }

  if (identifier.includes("@")) {
    const user = await findByEmail(identifier);
    if (!user || user.role !== "LENDER") {
      return {
        mode: "ERROR",
        error:
          "No lender access for that address. Ask your IMGC contact to grant access first.",
      };
    }
    const { devCode } = await issueOtp(user.email);
    return { mode: "OTP", email: user.email, devCode: isDev ? devCode : undefined };
  }

  const staff = await findByEmployeeId(identifier);
  if (!staff || staff.role !== "IMGC") {
    return { mode: "ERROR", error: "That Employee ID is not recognised." };
  }
  return {
    mode: "PASSWORD",
    employeeId: staff.employeeId ?? identifier,
    name: staff.name,
  };
}

export async function passwordLoginAction(
  employeeId: string,
  password: string,
  returnTo?: string
): Promise<{ error: string } | never> {
  const user = await authenticateImgc(employeeId, password);
  if (!user) return { error: "That password is not right." };

  await createSession({
    userId: user.id,
    role: "IMGC",
    name: user.name,
    email: user.email,
  });
  redirect(safeReturnTo(returnTo));
}

export async function verifyOtpAction(
  email: string,
  code: string,
  returnTo?: string
): Promise<{ error: string } | never> {
  const result = await verifyOtp(email, code);
  if (!result.ok) {
    const message: Record<string, string> = {
      NO_CODE: "Ask for a new code.",
      EXPIRED: "That code has expired — ask for a new one.",
      LOCKED: "Too many attempts. Ask for a new code.",
      MISMATCH: "That code is not right.",
    };
    return { error: message[result.reason] ?? "That code is not right." };
  }

  const user = await findByEmail(email);
  if (!user || user.role !== "LENDER") {
    return { error: "That account no longer has access." };
  }
  const org = await getLenderOrgById(user.lenderOrgId);

  await createSession({
    userId: user.id,
    role: "LENDER",
    name: user.name,
    email: user.email,
    lenderOrgId: user.lenderOrgId,
    lenderDomain: org?.emailDomain,
  });
  redirect(safeReturnTo(returnTo));
}

export async function resendOtpAction(
  email: string
): Promise<{ devCode?: string; error?: string }> {
  const user = await findByEmail(email);
  if (!user || user.role !== "LENDER") return { error: "Unknown address." };
  const { devCode } = await issueOtp(user.email);
  return { devCode: isDev ? devCode : undefined };
}

/** Seeded demo sign-in — the screenshot's "Enter Demo Mode". */
export async function demoLoginAction(role: Role): Promise<{ error: string } | never> {
  if (role === "IMGC") {
    const staff = await findByEmployeeId("EMP-0001");
    if (!staff) return { error: "Demo data is not seeded." };
    await createSession({
      userId: staff.id,
      role: "IMGC",
      name: staff.name,
      email: staff.email,
    });
    redirect(ROUTES.dashboard);
  }

  const lender = await findByEmail("arjun@acme-bank.com");
  if (!lender) return { error: "Demo data is not seeded." };
  const org = await getLenderOrgById(lender.lenderOrgId);
  await createSession({
    userId: lender.id,
    role: "LENDER",
    name: lender.name,
    email: lender.email,
    lenderOrgId: lender.lenderOrgId,
    lenderDomain: org?.emailDomain,
  });
  redirect(ROUTES.dashboard);
}

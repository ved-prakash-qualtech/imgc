"use server";

import type {
  ServerErrorCode,
  ServerErrorParams,
} from "@imgc/config/errorCodes";
import { getLocale } from "next-intl/server";
import { redirectTo } from "@imgc/lib/zoneRedirect";

import { ROUTES } from "@imgc/constants/route";
import { createSession } from "@imgc/lib/auth/appSession";
import { issueOtp, verifyOtp } from "@imgc/data/server/auth/otp";
import {
  authenticateImgc,
  findByEmail,
  findByEmployeeId,
  getLenderOrgById,
} from "@imgc/data/services/portal/users.server";
import type { Role } from "@imgc/types/domain";

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
    return ROUTES.claimDashboard;
  }
  return returnTo;
}

export type StartLoginResult =
  | { mode: "PASSWORD"; employeeId: string; name: string }
  | { mode: "OTP"; email: string; devCode?: string }
  | { mode: "ERROR"; code: ServerErrorCode; codeParams?: ServerErrorParams };

/** Decide which of the two flows the identifier belongs to, and begin it. */
export async function startLoginAction(
  identifierRaw: string
): Promise<StartLoginResult> {
  const identifier = identifierRaw.trim();
  if (!identifier) {
    return { mode: "ERROR", code: "IDENTIFIER_REQUIRED" };
  }

  if (identifier.includes("@")) {
    const user = await findByEmail(identifier);
    if (!user || user.role !== "LENDER") {
      return {
        mode: "ERROR",
        code: "NO_LENDER_ACCESS",
      };
    }
    const { devCode } = await issueOtp(user.email);
    return {
      mode: "OTP",
      email: user.email,
      devCode: isDev ? devCode : undefined,
    };
  }

  const staff = await findByEmployeeId(identifier);
  if (!staff || staff.role !== "IMGC") {
    return { mode: "ERROR", code: "EMPLOYEE_ID_UNKNOWN" };
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
): Promise<{ code: ServerErrorCode; codeParams?: ServerErrorParams } | never> {
  const user = await authenticateImgc(employeeId, password);
  if (!user) return { code: "PASSWORD_WRONG" };

  await createSession({
    userId: user.id,
    role: "IMGC",
    isAdmin: user.isAdmin,
    name: user.name,
    email: user.email,
  });
  const locale = await getLocale();
  return redirectTo(safeReturnTo(returnTo), locale);
}

export async function verifyOtpAction(
  email: string,
  code: string,
  returnTo?: string
): Promise<{ code: ServerErrorCode; codeParams?: ServerErrorParams } | never> {
  const result = await verifyOtp(email, code);
  if (!result.ok) {
    const byReason: Record<string, ServerErrorCode> = {
      NO_CODE: "OTP_NO_CODE",
      EXPIRED: "OTP_EXPIRED",
      LOCKED: "OTP_LOCKED",
      MISMATCH: "OTP_MISMATCH",
    };
    return { code: byReason[result.reason] ?? "OTP_MISMATCH" };
  }

  const user = await findByEmail(email);
  if (!user || user.role !== "LENDER") {
    return { code: "ACCOUNT_ACCESS_REVOKED" };
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
  const locale = await getLocale();
  return redirectTo(safeReturnTo(returnTo), locale);
}

export async function resendOtpAction(email: string): Promise<{
  devCode?: string;
  code?: ServerErrorCode;
  codeParams?: ServerErrorParams;
}> {
  const user = await findByEmail(email);
  if (!user || user.role !== "LENDER") return { code: "ADDRESS_UNKNOWN" };
  const { devCode } = await issueOtp(user.email);
  return { devCode: isDev ? devCode : undefined };
}

/** Seeded demo sign-in — the screenshot's "Enter Demo Mode". */
export async function demoLoginAction(
  role: Role
): Promise<{ code: ServerErrorCode; codeParams?: ServerErrorParams } | never> {
  if (role === "IMGC") {
    const staff = await findByEmployeeId("EMP-0001");
    if (!staff) return { code: "DEMO_DATA_MISSING" };
    await createSession({
      userId: staff.id,
      role: "IMGC",
      name: staff.name,
      email: staff.email,
    });
    const locale = await getLocale();
    return redirectTo(ROUTES.claimDashboard, locale);
  }

  const lender = await findByEmail("arjun@hdfcbank.com");
  if (!lender) return { code: "DEMO_DATA_MISSING" };
  const org = await getLenderOrgById(lender.lenderOrgId);
  await createSession({
    userId: lender.id,
    role: "LENDER",
    name: lender.name,
    email: lender.email,
    lenderOrgId: lender.lenderOrgId,
    lenderDomain: org?.emailDomain,
  });
  const locale = await getLocale();
  return redirectTo(ROUTES.claimDashboard, locale);
}

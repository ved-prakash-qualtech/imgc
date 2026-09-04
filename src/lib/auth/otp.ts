import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";

import { readDb, writeDb } from "@/server/mock/db";
import { sendMail } from "@/server/mock/mailer";

/**
 * Email OTP for lender sign-in (prototype). Codes are 6 digits, valid 10 minutes, single-use,
 * max 5 verify attempts. There is no real mail delivery — the code is "sent" via the mock
 * mailer, so in dev it appears in the server console and on the Notifications page.
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hash(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export async function issueOtp(email: string): Promise<{ devCode: string }> {
  const normalized = email.trim().toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(12).toString("hex");

  await writeDb((db) => {
    db.otps = db.otps.filter((o) => o.email !== normalized);
    db.otps.push({
      email: normalized,
      codeHash: hash(code, salt),
      salt,
      expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
      attempts: 0,
      consumed: false,
    });
  });

  await sendMail({
    to: [normalized],
    subject: "Your IMGC Lender Portal sign-in code",
    body: `Your one-time code is ${code}. It expires in 10 minutes.`,
    event: "OTP_ISSUED",
  });

  return { devCode: code };
}

export type OtpResult =
  | { ok: true }
  | { ok: false; reason: "NO_CODE" | "EXPIRED" | "LOCKED" | "MISMATCH" };

export async function verifyOtp(email: string, code: string): Promise<OtpResult> {
  const normalized = email.trim().toLowerCase();
  const db = await readDb();
  const otp = db.otps.find((o) => o.email === normalized);

  if (!otp || otp.consumed) return { ok: false, reason: "NO_CODE" };
  if (Date.parse(otp.expiresAt) < Date.now()) return { ok: false, reason: "EXPIRED" };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "LOCKED" };

  const matches = hash(code.trim(), otp.salt) === otp.codeHash;

  await writeDb((fresh) => {
    const row = fresh.otps.find((o) => o.email === normalized);
    if (!row) return;
    if (matches) row.consumed = true;
    else row.attempts += 1;
  });

  return matches ? { ok: true } : { ok: false, reason: "MISMATCH" };
}

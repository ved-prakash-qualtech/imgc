import "server-only";

import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for IMGC staff accounts (prototype). scrypt from Node's crypto — no external
 * dependency. Stored as `scrypt$<saltHex>$<hashHex>`.
 */

const KEYLEN = 64;

function format(salt: Buffer, hash: Buffer): string {
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return format(salt, hash);
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, (err, hash) => {
      if (err) reject(err);
      else resolve(format(salt, hash));
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return Promise.resolve(false);
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  return new Promise((resolve) => {
    scrypt(password, salt, expected.length, (err, hash) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(hash.length === expected.length && timingSafeEqual(hash, expected));
    });
  });
}

import "server-only";
import CryptoJS from "crypto-js";
import { getServerEnv } from "@/lib/serverEnv";
import { currentTenant } from "@/lib/tenant";
import { aesEncrypt, aesDecrypt } from "@/lib/aes";

/**
 * Multitenant AES-256-CBC encryption layer.
 *
 * Two derivation scopes — both use HMAC-SHA256(masterKey, scope):
 *
 *   Tenant-level  → scope = "tenant:{shortCode}"
 *   User-level    → scope = "tenant:{shortCode}:user:{userId}"
 *
 * Use tenant-level for data shared across a tenant (config, reports, etc.).
 * Use user-level  for data that belongs to a single user (PII, documents, etc.)
 * — a different key is derived for every (tenant, user) pair so that:
 *   - User A cannot decrypt User B's data (different keys)
 *   - The same userId in different tenants gets different keys
 *
 *   masterKey ─┬─ HMAC("tenant:qc")              → qc   tenant key
 *              ├─ HMAC("tenant:qc:user:u1")       → qc   / user-1 key
 *              ├─ HMAC("tenant:qc:user:u2")       → qc   / user-2 key
 *              └─ HMAC("tenant:client1:user:u1")  → client1 / user-1 key  (≠ qc/user-1)
 *
 * SERVER-ONLY: the master key is a secret — never import this module in
 * Client Components or pass derived keys to the browser.
 */

// ─── Key derivation ───────────────────────────────────────────────────────────

function deriveKey(masterKeyHex: string, scope: string): string {
  const masterKey = CryptoJS.enc.Hex.parse(masterKeyHex);
  return CryptoJS.HmacSHA256(scope, masterKey).toString(CryptoJS.enc.Hex);
}

async function getMasterKey(): Promise<string> {
  const env = await getServerEnv();
  if (!env.encryptionMasterKey) {
    throw new Error(
      "[tenantEncryption] ENCRYPTION_MASTER_KEY is not configured. " +
        "Add it to your .env (dev) or Vault secret path (production)."
    );
  }
  return env.encryptionMasterKey;
}

async function resolveTenantKey(tenantShortCode?: string): Promise<string> {
  const [master, tenant] = await Promise.all([
    getMasterKey(),
    tenantShortCode ?? currentTenant(),
  ]);
  return deriveKey(master, `tenant:${tenant}`);
}

async function resolveUserKey(
  userId: string,
  tenantShortCode?: string
): Promise<string> {
  const [master, tenant] = await Promise.all([
    getMasterKey(),
    tenantShortCode ?? currentTenant(),
  ]);
  return deriveKey(master, `tenant:${tenant}:user:${userId}`);
}

// ─── Tenant-level API ─────────────────────────────────────────────────────────

/**
 * Encrypt with the **tenant** key — shared across all users of that tenant.
 * Use for tenant-wide data (configuration, shared reports, audit logs, etc.).
 *
 * @param plaintext        UTF-8 string to protect
 * @param tenantShortCode  Optional — resolved from request context when omitted
 * @returns                `${ivHex}:${ciphertextBase64}`
 */
export async function encryptForTenant(
  plaintext: string,
  tenantShortCode?: string
): Promise<string> {
  return aesEncrypt(plaintext, await resolveTenantKey(tenantShortCode));
}

/**
 * Decrypt a ciphertext produced by `encryptForTenant`.
 *
 * @param ciphertext       `${ivHex}:${ciphertextBase64}`
 * @param tenantShortCode  Optional — resolved from request context when omitted
 */
export async function decryptForTenant(
  ciphertext: string,
  tenantShortCode?: string
): Promise<string> {
  return aesDecrypt(ciphertext, await resolveTenantKey(tenantShortCode));
}

// ─── User-level API ───────────────────────────────────────────────────────────

/**
 * Encrypt with a key unique to this **user inside their tenant**.
 * Use for PII or any data that belongs exclusively to one user.
 *
 * Every (tenant, userId) pair produces a distinct AES-256 key, so:
 *   - User B cannot decrypt User A's ciphertext
 *   - The same userId in a different tenant gets a completely different key
 *
 * @param plaintext        UTF-8 string to protect
 * @param userId           Stable, unique user identifier (e.g. UUID from JWT subject)
 * @param tenantShortCode  Optional — resolved from request context when omitted
 * @returns                `${ivHex}:${ciphertextBase64}`
 */
export async function encryptForUser(
  plaintext: string,
  userId: string,
  tenantShortCode?: string
): Promise<string> {
  return aesEncrypt(plaintext, await resolveUserKey(userId, tenantShortCode));
}

/**
 * Decrypt a ciphertext produced by `encryptForUser`.
 * Must be called with the same `userId` that was used during encryption.
 *
 * @param ciphertext       `${ivHex}:${ciphertextBase64}`
 * @param userId           Same stable user identifier used during encryption
 * @param tenantShortCode  Optional — resolved from request context when omitted
 */
export async function decryptForUser(
  ciphertext: string,
  userId: string,
  tenantShortCode?: string
): Promise<string> {
  return aesDecrypt(ciphertext, await resolveUserKey(userId, tenantShortCode));
}

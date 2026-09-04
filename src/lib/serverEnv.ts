import "server-only";

import { logger } from "@/lib/logging";
import { formatEnvZodError } from "@/lib/resolver/envSchema";
import { serverEnvSchema } from "@/lib/resolver/serverEnvSchema";

/**
 * getServerEnv() — single entry point for server-side configuration & secrets
 * (frontend-project-standards.md §4; backend counterpart: vault-and-secrets-setup.md).
 *
 * - When VAULT_ADDR is configured: secrets come from HashiCorp Vault (AppRole, KV v2)
 *   and are cached for 5 minutes.
 * - Otherwise: falls back to process.env (local development).
 *
 * Everything returned here is SERVER-ONLY — never expose a value to a Client
 * Component or a NEXT_PUBLIC_* variable.
 */

export interface ServerEnv {
  /** Base URL of the QCP backend this app talks to. */
  backendBaseUrl: string;
  /** Base URL of this app itself (used by the sample module's self-call). */
  appUrl: string;
  /** Super-admin backend URL — source of the tenant registry (tenantResolver). */
  superAdminUrl: string;
  /** API client credentials for service-to-service calls (Vault in production). */
  apiClientId?: string;
  apiClientSecret?: string;
  /**
   * AES-256 master key — 64 hex chars (32 bytes).
   * Per-tenant keys are derived from this via HMAC-SHA256(masterKey, "tenant:{shortCode}").
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  encryptionMasterKey?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { env: ServerEnv; at: number } | null = null;

async function fromVault(): Promise<Record<string, string>> {
  // Lazy import — node-vault is only loaded when Vault is actually configured
  const vault = (await import("node-vault")).default({
    endpoint: process.env.VAULT_ADDR,
  });
  const login = await vault.approleLogin({
    role_id: process.env.VAULT_ROLE_ID,
    secret_id: process.env.VAULT_SECRET_ID,
  });
  vault.token = login.auth.client_token;
  const secret = await vault.read(process.env.VAULT_SECRET_PATH ?? "");
  // KV v2 nests payload under data.data
  return (secret.data?.data ?? secret.data ?? {}) as Record<string, string>;
}

export async function getServerEnv(): Promise<ServerEnv> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.env;

  let secrets: Record<string, string> = {};
  if (process.env.VAULT_ADDR) {
    try {
      secrets = await fromVault();
    } catch (error) {
      logger.error("Vault fetch failed — falling back to process.env", {
        context: "serverEnv",
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  const appUrl =
    process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  const merged = {
    appUrl,
    // The sample module self-calls this app's own route handlers; point this
    // at a real QCP backend when building a product.
    backendBaseUrl:
      secrets.backendBaseUrl ?? process.env.BACKEND_BASE_URL ?? appUrl,
    // Tenant registry source — the stand-in routes serve it standalone
    superAdminUrl:
      secrets.superAdminUrl ?? process.env.SUPER_ADMIN_URL ?? appUrl,
    // Demo defaults keep the standalone tenant resolution working; Vault-managed in production
    apiClientId:
      secrets.apiClientId ??
      process.env.API_CLIENT_ID ??
      "template-demo-client",
    apiClientSecret:
      secrets.apiClientSecret ??
      process.env.API_CLIENT_SECRET ??
      "template-demo-secret",
    encryptionMasterKey:
      secrets.encryptionMasterKey ?? process.env.ENCRYPTION_MASTER_KEY,
  };

  const parsed = serverEnvSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(formatEnvZodError(parsed.error));
  }

  const env: ServerEnv = parsed.data;
  cached = { env, at: Date.now() };
  return env;
}

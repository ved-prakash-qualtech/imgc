import { z } from "zod";

/**
 * Zod shape for the resolved `ServerEnv` object (after Vault / process.env merge).
 * Public app config stays in `envSchema`; secrets stay in `getServerEnv()`.
 */
export const serverEnvSchema = z.object({
  appUrl: z.url(),
  backendBaseUrl: z.url(),
  superAdminUrl: z.url(),
  apiClientId: z.string().optional(),
  apiClientSecret: z.string().optional(),
  encryptionMasterKey: z.string().optional(),
});

export type ServerEnvParsed = z.infer<typeof serverEnvSchema>;

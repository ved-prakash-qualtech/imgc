"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/route";
import { requireSession } from "@/lib/auth/appSession";
import {
  saveLenderDocumentConfig,
  type Outcome,
} from "@/services/portal/lenderDocumentConfig.server";

/** IMGC only — replaces one lender's entire saved document configuration. */
export async function saveLenderDocumentConfigAction(
  lenderOrgId: string,
  rows: ReadonlyArray<{
    slug?: string;
    name: string;
    description?: string;
    required: boolean;
  }>
): Promise<Outcome> {
  const session = await requireSession();
  const result = await saveLenderDocumentConfig(session, lenderOrgId, rows);
  if (result.ok) revalidatePath(ROUTES.adminDocumentConfig);
  return result;
}

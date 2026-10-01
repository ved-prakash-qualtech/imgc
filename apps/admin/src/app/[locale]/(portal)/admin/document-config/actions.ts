"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@imgc/constants/route";
import { runAction } from "@imgc/data/server/actions/runAction";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  saveLenderDocumentConfig,
  type Outcome,
} from "@imgc/data/services/portal/lenderDocumentConfig.server";

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
  return runAction(async () => {
    const session = await requireSession();
    const result = await saveLenderDocumentConfig(session, lenderOrgId, rows);
    if (result.ok) revalidatePath(ROUTES.adminDocumentConfig);
    return result;
  });
}

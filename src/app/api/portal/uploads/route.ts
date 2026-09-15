import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_PATH_PREFIX,
} from "@/constants/uploads";
import { getSessionOrNull } from "@/lib/auth/appSession";
import { USING_BLOB } from "@/server/mock/storage";
import { getAccount } from "@/services/portal/accounts.server";

export const dynamic = "force-dynamic";

/**
 * Whether this environment takes uploads straight from the browser. `attachUpload` asks once per
 * page load: on a deployment the file goes directly to Blob; in local development (disk storage)
 * it travels in the upload action as before.
 */
export async function GET() {
  return NextResponse.json({ direct: USING_BLOB });
}

/**
 * Issues the short-lived token a browser needs to upload one document straight to Vercel Blob.
 *
 * A document used to travel inside the Server Action request, and Vercel refuses any function
 * request body over 4.5 MB before the app sees it. Uploading to Blob directly takes the file out
 * of that request entirely; the action then receives only the file's address.
 *
 * The token is narrow on purpose: only a signed-in user who can reach the account, only under that
 * account's own folder, only the accepted document types, and only up to the upload limit. Blob
 * enforces the type and size itself, and the action re-checks the stored file before recording it
 * (`storeIncomingUpload`), so nothing here trusts what the browser claims about the file.
 */
export async function POST(request: Request) {
  if (!USING_BLOB) {
    return NextResponse.json(
      { error: "Direct uploads are not enabled here." },
      { status: 404 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getSessionOrNull();
        if (!session) throw new Error("Sign in to upload a document.");

        const { accountId } = JSON.parse(clientPayload ?? "{}") as {
          accountId?: string;
        };
        if (!accountId || !(await getAccount(session, accountId))) {
          throw new Error("You cannot upload documents to that account.");
        }
        if (!pathname.startsWith(`${UPLOAD_PATH_PREFIX}/${accountId}/`)) {
          throw new Error("That upload location is not allowed.");
        }

        return {
          allowedContentTypes: [...ACCEPTED_UPLOAD_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "That upload could not be authorised.",
      },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { getSessionOrNull } from "@/lib/auth/appSession";
import { readDb } from "@/server/mock/db";
import { readUpload } from "@/server/mock/storage";

/**
 * Serve an uploaded document file by its DocumentFile ID.
 *
 * Security: the caller must be authenticated (session cookie). A LENDER user may only
 * access files that belong to their own organisation's accounts.  IMGC users may access
 * any file.  If access is denied or the file record doesn't exist the route returns 403.
 *
 * Usage:  GET /api/portal/files/{fileId}
 *
 * The browser receives the raw bytes with the correct MIME type and a
 * `Content-Disposition: inline` header so PDFs and images open directly in the tab.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getSessionOrNull();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fileId } = await params;

  const db = await readDb();
  const docFile = db.documentFiles.find((f) => f.id === fileId);
  if (!docFile) {
    return new NextResponse("File not found", { status: 404 });
  }

  // Scope check: lender may only view files on their own accounts.
  if (session.role === "LENDER") {
    const account = db.accounts.find((a) => a.id === docFile.accountId);
    if (!account || account.lenderOrgId !== session.lenderOrgId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Seeded/demo rows have an empty storedPath — return 404 for those.
  if (!docFile.storedPath) {
    return new NextResponse("File not available (demo record)", { status: 404 });
  }

  // The locator comes from the authenticated DB record — a Blob URL on a deployment, an
  // absolute path for anything written by a local run. `readUpload` handles both.
  const bytes = await readUpload(docFile.storedPath);
  if (!bytes) {
    return new NextResponse("File not found in storage", { status: 404 });
  }

  const mime = docFile.mime || "application/octet-stream";
  const safeName = encodeURIComponent(docFile.originalName);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      // inline: browser opens in tab; attachment would force download.
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "Content-Length": String(bytes.length),
      // Do not cache — documents can be superseded.
      "Cache-Control": "no-store",
    },
  });
}

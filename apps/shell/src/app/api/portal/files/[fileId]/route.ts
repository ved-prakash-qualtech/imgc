import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { getSessionOrNull } from "@imgc/lib/auth/appSession";
import { readDb } from "@imgc/data/server/mock/db";
import { readUpload } from "@imgc/data/server/mock/storage";

/** The sample PDFs shown for seeded demo documents; `readUpload` resolves them under `public/`. */
function demoPlaceholderPath(originalName: string): string {
  const file = /legal|collection/i.test(originalName)
    ? "legal-collection-feedback.pdf"
    : "property-documents.pdf";
  return path.join(process.cwd(), "public", "demo", file);
}

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

  // Seeded/demo rows have no stored file. Show the bundled sample PDF for them, so a document row
  // in the demo data opens something rather than a 404.
  const isDemoRecord = !docFile.storedPath;

  // The locator comes from the authenticated DB record — a Blob URL on a deployment, an
  // absolute path for anything written by a local run. `readUpload` handles both.
  const bytes = await readUpload(
    isDemoRecord
      ? demoPlaceholderPath(docFile.originalName)
      : docFile.storedPath
  );
  if (!bytes) {
    return new NextResponse("File not found in storage", { status: 404 });
  }

  const mime = isDemoRecord
    ? "application/pdf"
    : docFile.mime || "application/octet-stream";
  const safeName = encodeURIComponent(docFile.originalName);

  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      // inline: browser opens in tab; attachment would force download.
      "Content-Disposition": `${disposition}; filename*=UTF-8''${safeName}`,
      "Content-Length": String(bytes.length),
      // Do not cache — documents can be superseded.
      "Cache-Control": "no-store",
    },
  });
}

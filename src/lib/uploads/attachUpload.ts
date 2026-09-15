import { upload } from "@vercel/blob/client";

import { UPLOAD_PATH_PREFIX } from "@/constants/uploads";

/**
 * Whether this environment takes uploads straight from the browser — asked once per page load,
 * then remembered. A failed check falls back to the ordinary upload and is asked again next time.
 */
let directMode: Promise<boolean> | null = null;

function directUploadsEnabled(): Promise<boolean> {
  directMode ??= fetch("/api/portal/uploads", { cache: "no-store" })
    .then((res) =>
      res.ok ? (res.json() as Promise<{ direct?: boolean }>) : { direct: false }
    )
    .then((body) => body.direct === true)
    .catch(() => {
      directMode = null;
      return false;
    });
  return directMode;
}

/**
 * Put a picked file onto an upload action's `FormData`.
 *
 * On a deployment the file is uploaded straight to Vercel Blob first and only its address goes to
 * the action (`blobUrl` + `fileName`): a file inside the action request would be refused by
 * Vercel above 4.5 MB before the app ever saw it. In local development the file itself goes on the
 * form, exactly as before. The action reads either shape (`incomingUploadFrom`).
 *
 * Throws if the direct upload fails; callers show that as the upload's error.
 */
export async function attachUpload(
  data: FormData,
  file: File,
  accountId: string
): Promise<void> {
  if (!(await directUploadsEnabled())) {
    data.set("file", file);
    return;
  }

  const safeName =
    file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "document";
  const blob = await upload(
    `${UPLOAD_PATH_PREFIX}/${accountId}/${safeName}`,
    file,
    {
      access: "public",
      handleUploadUrl: "/api/portal/uploads",
      clientPayload: JSON.stringify({ accountId }),
      // Large files go up in parallel parts, each retried on its own if the connection drops.
      multipart: file.size > 5 * 1024 * 1024,
    }
  );
  data.delete("file");
  data.set("blobUrl", blob.url);
  data.set("fileName", file.name);
}

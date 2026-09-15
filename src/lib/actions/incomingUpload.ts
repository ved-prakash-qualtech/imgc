import "server-only";

import type { IncomingUpload } from "@/server/mock/storage";

/**
 * The document an upload action received: the file itself (local development), or the address
 * the browser already uploaded it to (a deployment — see `attachUpload`). `null` when the form
 * carries neither, which the caller reports as "choose a file".
 */
export function incomingUploadFrom(formData: FormData): IncomingUpload | null {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) return file;

  const url = formData.get("blobUrl");
  if (typeof url === "string" && url) {
    return { url, name: String(formData.get("fileName") ?? "") };
  }
  return null;
}

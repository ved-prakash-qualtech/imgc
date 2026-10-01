/**
 * Upload rules shared by the upload dialogs, the direct-upload token route and the services that
 * record a file — one definition, so the browser's check, Blob's own enforcement and the server's
 * check can never disagree.
 *
 * On a deployment the browser uploads the file straight to Vercel Blob (see `attachUpload`), so
 * the file never travels inside a Server Action request and Vercel's 4.5 MB cap on a function
 * request body does not apply. In local development the file does travel in the action request;
 * `serverActions.bodySizeLimit` in next.config.ts raises Next's 1 MB default to fit.
 */

/** The largest document one upload may carry. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "15 MB";

/** The document types an upload may be. */
export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Where uploaded files live in the store: `imgc/uploads/<accountId>/<file>`. */
export const UPLOAD_PATH_PREFIX = "imgc/uploads";

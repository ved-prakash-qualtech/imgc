import records from "./translations/records.en.json";

/**
 * Wording that is written into stored records — audit-log summaries, status-history notes and the
 * notification outbox. It lives in `translations/records.en.json`, apart from the UI catalogues:
 * a record is saved once, in English, and read back as written by whichever locale opens it, so it
 * is not translated per viewer and has no business in the client bundle.
 */
type Params = Readonly<Record<string, string | number | undefined>>;

const FLAT = new Map<string, string>();
(function flatten(node: unknown, prefix: string): void {
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") FLAT.set(path, value);
    else flatten(value, path);
  }
})(records.records, "");

/** `msg("audit.draftSaved")`, `msg("audit.claimMarked", { status })` — `{param}` placeholders. */
export function msg(key: string, params: Params = {}): string {
  const text = FLAT.get(key);
  if (text === undefined) throw new Error(`Missing record message: ${key}`);
  const values = new Map(Object.entries(params));
  return text.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values.get(name) ?? "")
  );
}

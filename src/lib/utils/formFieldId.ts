import { appConfig } from "@/constants/config";

function slugifyForFieldId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Kebab-case prefix for form control `id` / `htmlFor` attributes (derived from app name). */
export const FORM_FIELD_ID_PREFIX = slugifyForFieldId(appConfig.name);

export function buildFormFieldId(
  fieldName: string | number | symbol,
  id?: string
): string {
  return id ?? `${FORM_FIELD_ID_PREFIX}-${String(fieldName)}`;
}

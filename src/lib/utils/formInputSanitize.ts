import type { FormInputRegexType } from "@/types/forms";

const INPUT_REGEX_SANITIZERS: Record<
  FormInputRegexType,
  (value: string) => string
> = {
  specialChar: (value) => value.replace(/[^A-Za-z\s0-9,&.\-_*&]+/g, ""),
  dotChar: (value) => value.replace(/[^A-Za-z\s0-9,&.\-_]+/g, ""),
  addressChar: (value) => value.replace(/[^A-Za-z\s0-9,\-_&.'#$/@%\/]+/g, ""),
  alphaNumeric: (value) => value.replace(/[^A-Za-z0-9]+/g, ""),
  character: (value) => value.replace(/[^A-Za-z]/g, ""),
  space: (value) => value.replace(/[^a-zA-Z\s]+/g, ""),
  restrictNumberAndSymbols: (value) => value.replace(/[0-9&%^~!]/g, ""),
  numberWithoutExpo: (value) => value.replace(/[^0-9]/g, ""),
  number: (value) => value.replace(/[^0-9]/g, ""),
};

export function applyMaxLength(value: string, maxLength?: number): string {
  if (maxLength !== undefined && value.length > maxLength) {
    return value.slice(0, maxLength);
  }
  return value;
}

export function shouldUseSanitizedChange(
  regexType: FormInputRegexType | undefined,
  maxLength?: number
): boolean {
  if (maxLength !== undefined) return true;
  return regexType !== undefined && regexType !== "number";
}

export function sanitizeFormInputValue(
  raw: string,
  regexType?: FormInputRegexType,
  maxLength?: number
): string {
  const sanitize = regexType
    ? INPUT_REGEX_SANITIZERS[regexType]
    : (value: string) => value;
  return applyMaxLength(sanitize(raw), maxLength);
}

export function stripNumericGrouping(value: string): string {
  return value.replace(/,/g, "");
}

export function isAllowedOptionValue(
  value: string | number | undefined,
  allowedValues: ReadonlyArray<string | number>
): boolean {
  if (value === undefined || value === "") return true;
  const normalized = String(value);
  return allowedValues.some((allowed) => String(allowed) === normalized);
}

export function clampDate(date: Date, minDate: Date, maxDate: Date): Date {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

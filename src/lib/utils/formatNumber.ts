export function formatNumber(value: string | number, locale: string): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const stringValue = String(value).replaceAll(",", "");
  const inputValue = Number.parseFloat(stringValue);

  if (!Number.isNaN(inputValue)) {
    return inputValue.toLocaleString(locale);
  }

  return "";
}

export function readEnvValue(key: string, defaultValue = ""): string {
  // eslint-disable-next-line security/detect-object-injection -- keys are internal constants only
  const raw = process.env[key];
  if (raw === undefined || raw === null) {
    return defaultValue;
  }

  let value = String(raw).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || defaultValue;
}

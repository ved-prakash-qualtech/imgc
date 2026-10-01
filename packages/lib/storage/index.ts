type StorageKind = "local" | "session";

function getStorage(kind: StorageKind): Storage | null {
  if (globalThis.window === undefined) return null;
  return kind === "local" ? globalThis.localStorage : globalThis.sessionStorage;
}

function serialize<T>(value: T): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function deserialize<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function setItem<T>(kind: StorageKind, key: string, value: T): void {
  getStorage(kind)?.setItem(key, serialize(value));
}

function getItem<T>(kind: StorageKind, key: string): T | null {
  const raw = getStorage(kind)?.getItem(key) ?? null;
  if (raw === null) return null;
  return deserialize<T>(raw);
}

function removeItem(kind: StorageKind, key: string): void {
  getStorage(kind)?.removeItem(key);
}

export function setLocalItem<T>(key: string, value: T): void {
  setItem("local", key, value);
}

export function getLocalItem<T>(key: string): T | null {
  return getItem<T>("local", key);
}

export function removeLocalItem(key: string): void {
  removeItem("local", key);
}

export function setSessionItem<T>(key: string, value: T): void {
  setItem("session", key, value);
}

export function getSessionItem<T>(key: string): T | null {
  return getItem<T>("session", key);
}

export function removeSessionItem(key: string): void {
  removeItem("session", key);
}

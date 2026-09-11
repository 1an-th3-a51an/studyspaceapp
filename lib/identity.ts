export const STORAGE_KEYS = {
  deviceId: "studyspace.deviceId",
  netId: "studyspace.netId",
  demo: "studyspace.demo",
  displayName: "studyspace.displayName",
  gcalEvents: "studyspace.gcalEvents",
  coursetableEvents: "studyspace.coursetableEvents",
  localPools: "studyspace.localPools",
  examUrgency: "studyspace.examUrgency",
  includeCoffeeShops: "studyspace.includeCoffeeShops",
  maxExtraWalkingMinutes: "studyspace.maxExtraWalkingMinutes",
  recurringAutobook: "studyspace.recurringAutobook",
  clubSize: "studyspace.clubSize",
  origin: "studyspace.origin",
} as const;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function ensureDeviceId(): string {
  if (!canUseStorage()) return "";
  let id = localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.deviceId, id);
  }
  return id;
}

export function getNetId(): string {
  if (!canUseStorage()) return "";
  return localStorage.getItem(STORAGE_KEYS.netId) ?? "";
}

export function setNetId(netId: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.netId, netId.trim());
}

export function isDemoMode(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(STORAGE_KEYS.demo) === "true";
}

export function setDemoMode(on: boolean) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.demo, on ? "true" : "false");
}

export function getDisplayName(): string {
  if (!canUseStorage()) return "";
  return localStorage.getItem(STORAGE_KEYS.displayName) ?? "";
}

export function setDisplayName(name: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.displayName, name);
}

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

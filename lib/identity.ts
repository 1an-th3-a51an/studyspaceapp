export const STORAGE_KEYS = {
  deviceId: "studyspace.deviceId",
  netId: "studyspace.netId",
  demo: "studyspace.demo",
  displayName: "studyspace.displayName",
  gcalEvents: "studyspace.gcalEvents",
  coursetableEvents: "studyspace.coursetableEvents",
  gcalDeadlines: "studyspace.gcalDeadlines",
  coursetableDeadlines: "studyspace.coursetableDeadlines",
  notifyEmail: "studyspace.notifyEmail",
  localPools: "studyspace.localPools",
  examUrgency: "studyspace.examUrgency",
  includeCoffeeShops: "studyspace.includeCoffeeShops",
  maxExtraWalkingMinutes: "studyspace.maxExtraWalkingMinutes",
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

/** Fired after an import or demo-mode change so open pages re-read storage. */
export const SCHEDULE_CHANGED_EVENT = "studyspace:schedule-changed";

function announceScheduleChange() {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(SCHEDULE_CHANGED_EVENT));
}

export function setDemoMode(on: boolean) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.demo, on ? "true" : "false");
  announceScheduleChange();
}

export function getDisplayName(): string {
  if (!canUseStorage()) return "";
  return localStorage.getItem(STORAGE_KEYS.displayName) ?? "";
}

export function setDisplayName(name: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.displayName, name);
}

/** Where booking announcements are emailed. Empty means "not subscribed". */
export function getNotifyEmail(): string {
  if (!canUseStorage()) return "";
  return localStorage.getItem(STORAGE_KEYS.notifyEmail) ?? "";
}

export function setNotifyEmail(email: string) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.notifyEmail, email.trim());
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

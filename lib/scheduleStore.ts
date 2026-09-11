import {
  readJson,
  SCHEDULE_CHANGED_EVENT,
  setDemoMode,
  STORAGE_KEYS,
  writeJson,
} from "@/lib/identity";
import type { ClassMeeting, Deadline, ParsedCalendarSource, RoomPrefs } from "@/lib/types";

const EVENT_KEYS: Record<ParsedCalendarSource, string> = {
  gcal: STORAGE_KEYS.gcalEvents,
  "coursetable-ics": STORAGE_KEYS.coursetableEvents,
};

const DEADLINE_KEYS: Record<ParsedCalendarSource, string> = {
  gcal: STORAGE_KEYS.gcalDeadlines,
  "coursetable-ics": STORAGE_KEYS.coursetableDeadlines,
};

/** Re-exported so existing imports keep working. */
export { SCHEDULE_CHANGED_EVENT };

function announceChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SCHEDULE_CHANGED_EVENT));
}

export function getGcalEvents(): ClassMeeting[] {
  return readJson<ClassMeeting[]>(STORAGE_KEYS.gcalEvents, []);
}

export function getCourseTableEvents(): ClassMeeting[] {
  return readJson<ClassMeeting[]>(STORAGE_KEYS.coursetableEvents, []);
}

export function getGcalDeadlines(): Deadline[] {
  return readJson<Deadline[]>(STORAGE_KEYS.gcalDeadlines, []);
}

export function getCourseTableDeadlines(): Deadline[] {
  return readJson<Deadline[]>(STORAGE_KEYS.coursetableDeadlines, []);
}

export function setGcalEvents(events: ClassMeeting[]) {
  writeJson(STORAGE_KEYS.gcalEvents, events);
  announceChange();
}

export function setCourseTableEvents(events: ClassMeeting[]) {
  writeJson(STORAGE_KEYS.coursetableEvents, events);
  announceChange();
}

/** Replace one source's whole import: classes and due dates together. */
export function setCalendarImport(
  source: ParsedCalendarSource,
  input: { meetings: ClassMeeting[]; deadlines: Deadline[] },
) {
  writeJson(EVENT_KEYS[source], input.meetings);
  writeJson(DEADLINE_KEYS[source], input.deadlines);
  // A connected calendar replaces Handsome Dan. setDemoMode also announces.
  setDemoMode(false);
}

export function clearCalendarImports() {
  for (const source of Object.keys(EVENT_KEYS) as ParsedCalendarSource[]) {
    writeJson(EVENT_KEYS[source], []);
    writeJson(DEADLINE_KEYS[source], []);
  }
  announceChange();
}

export function hasCalendarImport(): boolean {
  return getGcalEvents().length > 0 || getCourseTableEvents().length > 0;
}

const DEFAULT_PREFS: RoomPrefs = {
  examUrgency: 0.4,
  includeCoffeeShops: true,
  maxExtraWalkingMinutes: 10,
};

export function getRoomPrefs(): RoomPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  return {
    examUrgency: Number(
      localStorage.getItem(STORAGE_KEYS.examUrgency) ?? DEFAULT_PREFS.examUrgency,
    ),
    includeCoffeeShops:
      (localStorage.getItem(STORAGE_KEYS.includeCoffeeShops) ?? "true") ===
      "true",
    maxExtraWalkingMinutes: Number(
      localStorage.getItem(STORAGE_KEYS.maxExtraWalkingMinutes) ??
        DEFAULT_PREFS.maxExtraWalkingMinutes,
    ),
  };
}

export function setRoomPrefs(prefs: RoomPrefs) {
  localStorage.setItem(STORAGE_KEYS.examUrgency, String(prefs.examUrgency));
  localStorage.setItem(
    STORAGE_KEYS.includeCoffeeShops,
    String(prefs.includeCoffeeShops),
  );
  localStorage.setItem(
    STORAGE_KEYS.maxExtraWalkingMinutes,
    String(prefs.maxExtraWalkingMinutes),
  );
}

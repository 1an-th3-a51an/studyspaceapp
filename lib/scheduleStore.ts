import {
  readJson,
  STORAGE_KEYS,
  writeJson,
} from "@/lib/identity";
import type { ClassMeeting, RoomPrefs } from "@/lib/types";

export function getGcalEvents(): ClassMeeting[] {
  return readJson<ClassMeeting[]>(STORAGE_KEYS.gcalEvents, []);
}

export function getCourseTableEvents(): ClassMeeting[] {
  return readJson<ClassMeeting[]>(STORAGE_KEYS.coursetableEvents, []);
}

export function setGcalEvents(events: ClassMeeting[]) {
  writeJson(STORAGE_KEYS.gcalEvents, events);
}

export function setCourseTableEvents(events: ClassMeeting[]) {
  writeJson(STORAGE_KEYS.coursetableEvents, events);
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

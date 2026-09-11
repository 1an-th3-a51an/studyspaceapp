import { getBuilding, LANDMARK_IDS, type OriginChoice } from "@/lib/geo";
import { readJson, STORAGE_KEYS, writeJson } from "@/lib/identity";
import { getRoomPrefs, setRoomPrefs } from "@/lib/scheduleStore";
import type { RoomPrefs } from "@/lib/types";

/**
 * Tune: describe how you study in plain English and the app reshapes its
 * defaults around you. Deterministic and offline: a small rule set maps
 * phrases to the same settings the sliders, origin picker, and search box
 * already use, so nothing here invents a second configuration system.
 */

export type TunePrefs = {
  /** Search prefilled on the Rooms page. */
  defaultQuery: string;
  /** Default seats / queue size. */
  preferredGroupSize: number | null;
  /** Landmark id the walking origin was set to, if any. */
  landmarkId: string | null;
  lastPrompt: string;
  updatedAt: string | null;
};

export type TuneChange = { label: string; value: string };

export const TUNE_STORAGE_KEY = "studyspace.tune";
export const TUNE_CHANGED_EVENT = "studyspace:tune";

export const DEFAULT_ROOM_PREFS: RoomPrefs = {
  examUrgency: 0.4,
  includeCoffeeShops: true,
  maxExtraWalkingMinutes: 10,
};

const EMPTY: TunePrefs = {
  defaultQuery: "",
  preferredGroupSize: null,
  landmarkId: null,
  lastPrompt: "",
  updatedAt: null,
};

export function readTune(): TunePrefs {
  return { ...EMPTY, ...readJson<Partial<TunePrefs>>(TUNE_STORAGE_KEY, {}) };
}

export function writeTune(prefs: TunePrefs) {
  writeJson(TUNE_STORAGE_KEY, prefs);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TUNE_CHANGED_EVENT, { detail: prefs }));
  }
}

const LANDMARK_WORDS: { id: (typeof LANDMARK_IDS)[number]; words: string[] }[] = [
  { id: "kbt", words: ["science hill", "kline", "marx", "prospect"] },
  { id: "davies", words: ["davies", "becton", "ceid", "engineering"] },
  { id: "hq", words: ["hq", "humanities quad", "humanities"] },
  { id: "sterling", words: ["sterling"] },
  { id: "cross-campus", words: ["cross campus", "bass"] },
  { id: "old-campus", words: ["old campus", "phelps"] },
];

/** Words that carry over into the Rooms search box, in this order. */
const QUERY_WORDS = [
  "silent", "quiet", "whiteboard", "monitor", "screen", "projector", "outlets",
  "natural light", "window", "bright", "cozy", "private", "enclosed", "late night",
  "24/7", "food", "lunch", "tea", "group", "solo", "big table", "standing",
  "accessible", "reading", "writing", "coding", "presentation",
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

function parseGroupSize(text: string): number | null {
  const q = text.toLowerCase();
  if (/\b(alone|by myself|solo|on my own)\b/.test(q)) return 1;
  const digit = q.match(/\b(\d{1,2})\s*(people|ppl|of us|friends|students|person)\b/) ??
    q.match(/\b(?:group|team|party)s?\s+of\s+(\d{1,2})\b/) ??
    q.match(/\b(?:with|for)\s+(\d{1,2})\b/);
  if (digit) return Math.max(1, Math.min(8, Number(digit[1])));
  const word = q.match(/\b(one|two|three|four|five|six|seven|eight)\s+(people|ppl|of us|friends|students)\b/);
  if (word) return NUMBER_WORDS[word[1]];
  if (/\b(a partner|one friend|one other|pair|my friend|tutor|tutoring)\b/.test(q)) return 2;
  return null;
}

/**
 * Turn a description into concrete settings. Returns what changed so the
 * page can show it. Writes to the same storage the rest of the app reads.
 */
export function applyTune(text: string): { changes: TuneChange[]; prefs: TunePrefs } {
  const q = text.toLowerCase().replace(/\s+/g, " ").trim();
  const changes: TuneChange[] = [];
  const room: RoomPrefs = { ...getRoomPrefs() };
  const tune = readTune();

  // Coffee shops
  if (/\b(no|not|without|skip|hate|never)\b[^.]{0,20}\b(coffee|cafe|cafes)\b/.test(q) || /\b(library|libraries) only\b/.test(q)) {
    room.includeCoffeeShops = false;
    changes.push({ label: "Coffee shops", value: "off" });
  } else if (/\b(coffee|cafe|cafes|latte|espresso|caffeine)\b/.test(q)) {
    room.includeCoffeeShops = true;
    changes.push({ label: "Coffee shops", value: "on" });
  }

  // Exam urgency
  if (/\b(exam|midterm|final|finals|cram|crunch|deadline tomorrow|panic)\b/.test(q)) {
    room.examUrgency = 0.9;
    changes.push({ label: "Exam urgency", value: "high (rooms beat cafes)" });
  } else if (/\b(chill|relaxed|casual|low[- ]key|no rush|light work)\b/.test(q)) {
    room.examUrgency = 0.2;
    changes.push({ label: "Exam urgency", value: "low" });
  }

  // Walking tolerance
  const walkMatch = q.match(/\b(\d{1,2})\s*(?:min|mins|minute|minutes)\b[^.]{0,15}\b(walk|walking)\b/) ??
    q.match(/\b(walk|walking)\b[^.]{0,15}\b(\d{1,2})\s*(?:min|mins|minute|minutes)\b/);
  if (walkMatch) {
    const n = Number(walkMatch[1]) || Number(walkMatch[2]);
    if (Number.isFinite(n)) {
      room.maxExtraWalkingMinutes = Math.max(0, Math.min(20, n));
      changes.push({ label: "Extra walking for coffee", value: `${room.maxExtraWalkingMinutes} min` });
    }
  } else if (/\b(hate walking|don'?t (like|want to) walk|close by|nearby|nearest|closest|lazy)\b/.test(q)) {
    room.maxExtraWalkingMinutes = 3;
    changes.push({ label: "Extra walking for coffee", value: "3 min" });
  } else if (/\b(don'?t mind walking|happy to walk|love walking|far is fine)\b/.test(q)) {
    room.maxExtraWalkingMinutes = 18;
    changes.push({ label: "Extra walking for coffee", value: "18 min" });
  }

  // Group size
  const size = parseGroupSize(q);
  if (size !== null) {
    tune.preferredGroupSize = size;
    changes.push({ label: "Default group size", value: size === 1 ? "solo" : String(size) });
  }

  // Walking origin
  let originChoice: OriginChoice | null = null;
  for (const entry of LANDMARK_WORDS) {
    if (entry.words.some((w) => q.includes(w))) {
      originChoice = { kind: "landmark", id: entry.id };
      tune.landmarkId = entry.id;
      changes.push({ label: "Start walking from", value: getBuilding(entry.id)?.name ?? entry.id });
      break;
    }
  }
  if (!originChoice && /\b(after class|from class|between classes|next class)\b/.test(q)) {
    originChoice = { kind: "next-class" };
    tune.landmarkId = null;
    changes.push({ label: "Start walking from", value: "next class" });
  }

  // Search prefill
  const words = QUERY_WORDS.filter((w) => q.includes(w));
  if (!room.includeCoffeeShops) {
    const i = words.indexOf("food");
    if (i >= 0) words.splice(i, 1);
  }
  if (size === 1 && !words.includes("solo")) words.push("solo");
  if (size !== null && size >= 3 && !words.includes("group")) words.unshift("group");
  const defaultQuery = words.join(" ");
  if (defaultQuery !== tune.defaultQuery) {
    tune.defaultQuery = defaultQuery;
    changes.push({ label: "Rooms search prefill", value: defaultQuery || "cleared" });
  }

  setRoomPrefs(room);
  if (originChoice) writeJson(STORAGE_KEYS.origin, originChoice);
  tune.lastPrompt = text.trim();
  tune.updatedAt = new Date().toISOString();
  writeTune(tune);
  return { changes, prefs: tune };
}

export function resetTune(): void {
  setRoomPrefs(DEFAULT_ROOM_PREFS);
  writeJson(STORAGE_KEYS.origin, { kind: "next-class" } satisfies OriginChoice);
  writeTune({ ...EMPTY });
}

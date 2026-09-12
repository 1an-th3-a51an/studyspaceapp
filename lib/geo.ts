import snapshot from "@/lib/data/courseTableBuildings.json";
import type { StudyRecommendation } from "@/lib/types";

export type LatLng = { lat: number; lng: number };

export type Building = {
  id: string;
  name: string;
  address: string;
  point: LatLng;
  /** Lowercase substrings that identify this building in a free-text location. */
  aliases: string[];
  /** CourseTable building code (WLH, DL, …). Absent for landmark-only pins. */
  code?: string;
  source: "coursetable" | "landmark";
};

export type OriginChoice =
  | { kind: "next-class" }
  | { kind: "gps" }
  | { kind: "landmark"; id: string }
  /** Search from where one specific course on the user's schedule meets. */
  | { kind: "course"; courseCode: string };

export type ResolvedOrigin = {
  label: string;
  detail?: string;
  /** Null when the starting room is not in the CourseTable building table. */
  point: LatLng | null;
  placed: boolean;
};

export type LocationPlacement =
  | { ok: true; building: Building; matchedBy: "code" | "name" | "alias"; alias: string }
  | { ok: false; query: string };

type CourseTableBuildingRow = {
  code: string;
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
};

const WALK_METERS_PER_MINUTE = 80;
const DETOUR_FACTOR = 1.3;

const rows = (snapshot as { buildings: CourseTableBuildingRow[] }).buildings;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[.,'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenBoundaryPattern(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 1–2 char CourseTable codes ("DL", "PH", "S") only count with a room number
  // or as the whole query, so "S&DS 2380" does not become Sage Hall.
  if (alias.length <= 2) {
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=\\s+\\d|\\s+[a-z]\\d|$)`, "i");
  }
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

function fromCourseTable(row: CourseTableBuildingRow): Building {
  const aliases = [...new Set([row.code, row.name, ...(row.aliases ?? [])].map(normalize).filter(Boolean))];
  return {
    id: row.code.toLowerCase(),
    code: row.code,
    name: row.name,
    address: row.code,
    point: { lat: row.lat, lng: row.lng },
    aliases,
    source: "coursetable",
  };
}

/**
 * Manual starting points only. Never used as a fallback when a class room
 * is missing from CourseTable — that would revive the fake Phelps pin.
 */
const LANDMARK_ONLY: Building[] = [
  {
    id: "old-campus",
    name: "Old Campus (Phelps Gate)",
    address: "344 College St",
    point: { lat: 41.30844, lng: -72.92815 },
    aliases: ["old campus"],
    source: "landmark",
  },
  {
    id: "cross-campus",
    name: "Cross Campus",
    address: "Cross Campus",
    point: { lat: 41.3106, lng: -72.928 },
    aliases: ["cross campus"],
    source: "landmark",
  },
];

/** CourseTable buildings (source of truth) plus opt-in landmarks. */
export const BUILDINGS: Building[] = [
  ...rows.map(fromCourseTable),
  ...LANDMARK_ONLY,
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));
const COURSE_TABLE = BUILDINGS.filter((b) => b.source === "coursetable");
const PREFIX_CODES = new Set(
  COURSE_TABLE.flatMap((b) => {
    const code = b.code?.toLowerCase();
    if (!code) return [];
    return COURSE_TABLE.some((other) => {
      const otherCode = other.code?.toLowerCase();
      return Boolean(otherCode && otherCode !== code && otherCode.startsWith(code));
    })
      ? [code]
      : [];
  }),
);

/** Landmarks offered as manual starting points on the rooms page. */
export const LANDMARK_IDS = [
  "old-campus",
  "cross-campus",
  "sterling",
  "wlh",
  "davies",
  "hq",
  "yuag",
  "kbt",
] as const;

/** Older landmark ids → CourseTable building ids. */
const ID_ALIASES: Record<string, string> = {
  sterling: "sml",
  kbt: "kt",
};

export const DEFAULT_LANDMARK_ID = "old-campus";

export function getBuilding(id: string): Building | undefined {
  const key = ID_ALIASES[id.toLowerCase()] ?? id.toLowerCase();
  return BY_ID.get(key) ?? BUILDINGS.find((b) => b.code?.toLowerCase() === key);
}

/** Match a free-text class location like "WLH 011" or "William L. Harkness Hall". */
export function findBuilding(location: string | undefined): Building | undefined {
  const placed = placeLocation(location);
  return placed.ok ? placed.building : undefined;
}

/**
 * Look up a class/room string against CourseTable buildings.
 * Never invents Phelps Gate (or any other pin) if nothing matches.
 */
export function placeLocation(location: string | undefined): LocationPlacement {
  const query = location?.trim() ?? "";
  if (!query) return { ok: false, query };
  const haystack = normalize(query);
  let best: { building: Building; alias: string; matchedBy: "code" | "name" | "alias" } | undefined;

  for (const building of COURSE_TABLE) {
    for (const alias of building.aliases) {
      if (!alias || !tokenBoundaryPattern(alias).test(haystack)) continue;
      const matchedBy: "code" | "name" | "alias" =
        alias === building.code?.toLowerCase()
          ? "code"
          : alias === normalize(building.name)
            ? "name"
            : "alias";
      // BASS is a prefix of BASSLB — a bare "Bass C10F" is not Bass Center.
      if (
        matchedBy === "code" &&
        PREFIX_CODES.has(alias) &&
        !new RegExp(`(^|[^a-z0-9])${alias}(?=\\s+\\d|$)`, "i").test(haystack)
      ) {
        continue;
      }
      if (!best || alias.length > best.alias.length) {
        best = { building, alias, matchedBy };
      }
    }
  }

  return best
    ? { ok: true, building: best.building, matchedBy: best.matchedBy, alias: best.alias }
    : { ok: false, query };
}

/** Try the room string, then "COURSE · room". Course codes alone are not buildings. */
export function resolveClassOrigin(
  location?: string,
  courseCode?: string,
): LocationPlacement {
  const attempts = [
    location,
    location && courseCode ? `${courseCode} · ${location}` : undefined,
  ];
  for (const attempt of attempts) {
    const placed = placeLocation(attempt);
    if (placed.ok) return placed;
  }
  return { ok: false, query: location?.trim() || courseCode?.trim() || "" };
}

export function unplacedLocationMessage(query: string): string {
  const label = query.trim() || "this room";
  return `"${label}" is not in CourseTable's building list — no map pin and no walking time until you pick GPS or a known landmark.`;
}

/** Snap a study-spot label onto CourseTable coords when the building is known. */
export function courseTablePointForSpot(...queries: Array<string | undefined>): LatLng | undefined {
  for (const query of queries) {
    if (!query?.trim()) continue;
    const placed = placeLocation(query);
    if (!placed.ok) continue;
    if (placed.matchedBy === "name" || placed.matchedBy === "alias" || placed.alias.length >= 5) {
      return placed.building.point;
    }
    if (placed.matchedBy === "code" && /\b[a-z]{2,6}\d{0,3}\s+\d/i.test(query)) {
      return placed.building.point;
    }
  }
  return undefined;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function walkingMinutes(from: LatLng, to: LatLng): number {
  const meters = haversineMeters(from, to) * DETOUR_FACTOR;
  return Math.max(1, Math.ceil(meters / WALK_METERS_PER_MINUTE));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function directionsUrl(from: LatLng, to: LatLng): string {
  const o = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}`;
  const d = `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=walking`;
}

export function hasPoint(
  spot: StudyRecommendation,
): spot is StudyRecommendation & { lat: number; lng: number } {
  return typeof spot.lat === "number" && typeof spot.lng === "number";
}

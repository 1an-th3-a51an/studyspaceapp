import type { StudyRecommendation } from "@/lib/types";

export type LatLng = { lat: number; lng: number };

export type Building = {
  id: string;
  name: string;
  address: string;
  point: LatLng;
  /** Lowercase substrings that identify this building in a free-text location. */
  aliases: string[];
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
  /** Null when the starting room is not in the building database. */
  point: LatLng | null;
  placed: boolean;
};

export type LocationPlacement =
  | { ok: true; building: Building }
  | { ok: false; query: string };

// Average campus walking pace and a detour factor for street grids
// (straight-line distance under-counts real sidewalks).
const WALK_METERS_PER_MINUTE = 80;
const DETOUR_FACTOR = 1.3;

/** Yale buildings that show up as class locations or landmarks. */
export const BUILDINGS: Building[] = [
  {
    id: "davies",
    name: "Davies Auditorium (Becton Center)",
    address: "15 Prospect St",
    point: { lat: 41.31267, lng: -72.92512 },
    aliases: ["davies", "becton", "bct"],
  },
  {
    id: "luce",
    name: "Luce Hall",
    address: "34 Hillhouse Ave",
    point: { lat: 41.31444, lng: -72.92435 },
    aliases: ["luce"],
  },
  {
    id: "hq",
    name: "Humanities Quadrangle",
    address: "320 York St",
    point: { lat: 41.31231, lng: -72.92913 },
    aliases: ["hq", "humanities quad"],
  },
  {
    id: "yuag",
    name: "Yale University Art Gallery",
    address: "1111 Chapel St",
    point: { lat: 41.30844, lng: -72.93088 },
    aliases: ["yuag", "art gallery"],
  },
  {
    id: "17-hillhouse",
    name: "17 Hillhouse Avenue",
    address: "17 Hillhouse Ave",
    point: { lat: 41.31276, lng: -72.92346 },
    aliases: ["17 hillhouse"],
  },
  {
    id: "akw",
    name: "Arthur K. Watson Hall",
    address: "51 Prospect St",
    point: { lat: 41.31308, lng: -72.92485 },
    aliases: ["akw", "watson"],
  },
  {
    id: "sss",
    name: "Sheffield-Sterling-Strathcona Hall",
    address: "1 Prospect St",
    point: { lat: 41.31193, lng: -72.92522 },
    aliases: ["sss", "strathcona"],
  },
  {
    id: "dunham",
    name: "Dunham Laboratory",
    address: "10 Hillhouse Ave",
    point: { lat: 41.31232, lng: -72.92454 },
    aliases: ["dunham", "dl"],
  },
  {
    id: "mason",
    name: "Mason Laboratory",
    address: "9 Hillhouse Ave",
    point: { lat: 41.31216, lng: -72.92364 },
    aliases: ["mason", "ml"],
  },
  {
    id: "wlh",
    name: "William L. Harkness Hall",
    address: "100 Wall St",
    // College & Wall, SE corner of Cross Campus — not High St / Sterling and not Phelps Gate.
    point: { lat: 41.31083, lng: -72.92778 },
    aliases: [
      "william l. harkness",
      "william l harkness",
      "w. l. harkness",
      "w.l. harkness",
      "harkness hall",
      "harkness",
      "wlh",
    ],
  },
  {
    id: "lc",
    name: "Linsly-Chittenden Hall",
    address: "63 High St",
    point: { lat: 41.3086, lng: -72.92948 },
    aliases: ["lc", "linsly", "chittenden"],
  },
  {
    id: "kbt",
    name: "Kline Biology Tower",
    address: "219 Prospect St",
    point: { lat: 41.31724, lng: -72.92255 },
    aliases: ["kbt", "kline biology", "science hill"],
  },
  {
    id: "sterling",
    name: "Sterling Memorial Library",
    address: "120 High St",
    point: { lat: 41.31146, lng: -72.92894 },
    aliases: ["sterling", "sml"],
  },
  {
    id: "bass",
    name: "Bass Library",
    address: "110 Wall St",
    point: { lat: 41.3109, lng: -72.928 },
    aliases: ["bass"],
  },
  {
    id: "rosenkranz",
    name: "Rosenkranz Hall",
    address: "125 Prospect St",
    point: { lat: 41.31385, lng: -72.92355 },
    aliases: ["rosenkranz", "rkz"],
  },
  {
    id: "haas",
    name: "Haas Family Arts Library",
    address: "180 York St",
    point: { lat: 41.30877, lng: -72.93189 },
    aliases: ["haas", "arts library"],
  },
  {
    id: "marx",
    name: "Marx Science and Social Science Library",
    address: "219 Prospect St",
    point: { lat: 41.31724, lng: -72.92255 },
    aliases: ["marx", "csssi"],
  },
  {
    id: "old-campus",
    name: "Old Campus (Phelps Gate)",
    address: "344 College St",
    point: { lat: 41.30844, lng: -72.92815 },
    aliases: ["old campus", "phelps"],
  },
  {
    id: "cross-campus",
    name: "Cross Campus",
    address: "Cross Campus",
    point: { lat: 41.3106, lng: -72.928 },
    aliases: ["cross campus"],
  },
];

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

export const DEFAULT_LANDMARK_ID = "old-campus";

export function getBuilding(id: string): Building | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** Match a free-text class location like "Davies Auditorium" or "HQ 107" to a building. */
export function findBuilding(location: string | undefined): Building | undefined {
  const placed = placeLocation(location);
  return placed.ok ? placed.building : undefined;
}

/** Look up a class/room string. Never invents a building if nothing matches. */
export function placeLocation(location: string | undefined): LocationPlacement {
  const query = location?.trim() ?? "";
  if (!query) return { ok: false, query };
  const haystack = query.toLowerCase();
  let best: { building: Building; aliasLen: number } | undefined;
  for (const building of BUILDINGS) {
    for (const alias of building.aliases) {
      const trimmed = alias.trim();
      if (!trimmed) continue;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack)) continue;
      if (!best || trimmed.length > best.aliasLen) {
        best = { building, aliasLen: trimmed.length };
      }
    }
  }
  return best ? { ok: true, building: best.building } : { ok: false, query };
}

export function unplacedLocationMessage(query: string): string {
  const label = query.trim() || "this room";
  return `"${label}" is not in the database — no map pin and no walking time until you pick GPS or a known landmark.`;
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

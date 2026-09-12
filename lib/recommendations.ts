import { STUDY_SPOTS } from "@/lib/spots";
import {
  directionsUrl,
  haversineMeters,
  hasPoint,
  walkingMinutes,
  type LatLng,
} from "@/lib/geo";
import { LIBCAL_GRID_MINUTES } from "@/lib/libcal";
import type { RoomPrefs, StudyRecommendation } from "@/lib/types";

/**
 * How soon the person needs a seat. Modeled on ride-hailing tiers: the
 * cheapest-to-explain choice is "what gets me sitting down soonest", and the
 * others trade a short wait for a better room.
 */
export type UrgencyMode = "now" | "soon" | "flexible";

export const URGENCY_MODES: { mode: UrgencyMode; label: string; tagline: string; waitMinutes: number }[] = [
  { mode: "now", label: "Urgent", tagline: "Sit down soonest. Nearest ready seat wins.", waitMinutes: 0 },
  { mode: "soon", label: "Soon", tagline: "Best room that is ready within 30 min.", waitMinutes: 30 },
  { mode: "flexible", label: "Open to waiting", tagline: "Best room, even if the slot is later.", waitMinutes: 90 },
];

export type RankedSpot = StudyRecommendation & {
  directionsUrl?: string;
  /** Why this spot was placed where it is. */
  reason: string;
  /** Minutes until you could be sitting there: walk, plus the wait for the next grid slot if reservable. */
  readyInMinutes: number;
  /** ISO time you could be seated, when a start time is known. */
  readyAtIso?: string;
  access: "walk-in" | "reservable";
  /** 0..n fit score used by the Soon / Open-to-waiting tiers. */
  quality: number;
};

export type RecommendOptions = {
  mode?: UrgencyMode;
  /** Epoch ms; defaults to Date.now(). Pass from state so SSR and client agree. */
  now?: number;
  /** Seats the person wants; unknown capacity is not penalised. */
  groupSize?: number;
};

export type Recommendation = {
  primary: RankedSpot;
  rest: RankedSpot[];
};

function withDistances(
  spots: StudyRecommendation[],
  origin: LatLng | null,
): StudyRecommendation[] {
  return spots.map((spot) => {
    if (!origin || !hasPoint(spot)) {
      return { ...spot, walkingMinutes: 0, distanceMeters: undefined };
    }
    const to = { lat: spot.lat, lng: spot.lng };
    return {
      ...spot,
      distanceMeters: haversineMeters(origin, to),
      walkingMinutes: walkingMinutes(origin, to),
    };
  });
}

function isBookable(spot: StudyRecommendation): boolean {
  return Boolean(spot.bookingUrl);
}

/** Minutes until seated: walk there, then (for reservable rooms) the next 15-minute grid boundary. */
function readiness(spot: StudyRecommendation, now: number): { readyInMinutes: number; readyAtIso?: string } {
  const walk = Math.max(0, spot.walkingMinutes);
  if (!isBookable(spot)) return { readyInMinutes: walk, readyAtIso: new Date(now + walk * 60_000).toISOString() };
  const stepMs = LIBCAL_GRID_MINUTES * 60_000;
  const arrival = now + walk * 60_000;
  const slot = Math.ceil(arrival / stepMs) * stepMs;
  return { readyInMinutes: Math.ceil((slot - now) / 60_000), readyAtIso: new Date(slot).toISOString() };
}

function qualityScore(spot: StudyRecommendation, prefs: RoomPrefs, groupSize: number): number {
  const tags = new Set((spot.tags ?? []).map((t) => t.toLowerCase()));
  let q = 0;
  if (isBookable(spot)) q += 2;
  if (typeof spot.capacity === "number") {
    q += spot.capacity >= groupSize ? 1 : -2;
  }
  if (tags.has("whiteboard") || tags.has("monitor") || tags.has("projector") || tags.has("blackboard")) q += 1;
  if (tags.has("quiet") || tags.has("silent")) q += 0.5;
  if (tags.has("outlets")) q += 0.25;
  if (spot.kind === "coffee") q += prefs.includeCoffeeShops ? 0 : -3;
  if (prefs.examUrgency >= 0.85 && spot.kind === "coffee") q -= 1;
  return q;
}

/**
 * Pick where to study.
 *
 * Rank bookable Yale rooms by walk time from the origin. Coffee shops may win
 * only when they are allowed and within `maxExtraWalkingMinutes` of the
 * nearest room. This does not claim a LibCal cell is free — Yale shows live
 * availability on the room page.
 */
export function recommendSpaces(
  prefs: RoomPrefs,
  origin: LatLng | null,
  spots: StudyRecommendation[] = STUDY_SPOTS,
  options: RecommendOptions = {},
): Recommendation {
  const mode: UrgencyMode = options.mode ?? "now";
  const now = options.now ?? Date.now();
  const groupSize = Math.max(1, options.groupSize ?? 1);
  const tier = URGENCY_MODES.find((t) => t.mode === mode)!;

  type Scored = StudyRecommendation & {
    readyInMinutes: number;
    readyAtIso?: string;
    quality: number;
  };
  const scored: Scored[] = withDistances(spots, origin).map((s) => ({
    ...s,
    ...readiness(s, now),
    quality: qualityScore(s, prefs, groupSize),
  }));

  // Tier ordering. "now": soonest seat. "soon": best fit among seats ready
  // within the window, then everything else by readiness. "flexible": best
  // fit within a long window, readiness as tiebreak.
  const byReady = (a: Scored, b: Scored) =>
    a.readyInMinutes - b.readyInMinutes ||
    b.quality - a.quality ||
    (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
  const byQuality = (a: Scored, b: Scored) =>
    b.quality - a.quality || a.readyInMinutes - b.readyInMinutes;
  let ranked: Scored[];
  if (!origin) {
    // No real start point: do not rank as if everyone were at Old Campus.
    ranked = [...scored].sort(byQuality);
  } else if (mode === "now") {
    ranked = [...scored].sort(byReady);
  } else {
    const inWindow = scored.filter((s) => s.readyInMinutes <= tier.waitMinutes).sort(byQuality);
    const later = scored.filter((s) => s.readyInMinutes > tier.waitMinutes).sort(byReady);
    ranked = [...inWindow, ...later];
  }

  const rooms = ranked.filter((s) => s.kind === "room");
  const coffee = ranked.filter((s) => s.kind === "coffee");

  const nearestRoom = rooms[0];
  const coffeeBudget = nearestRoom
    ? nearestRoom.readyInMinutes + prefs.maxExtraWalkingMinutes
    : Number.POSITIVE_INFINITY;
  const coffeeAllowed = prefs.includeCoffeeShops && prefs.examUrgency < 0.85;
  const nearestCoffee =
    coffeeAllowed && mode !== "flexible"
      ? coffee.find((shop) => shop.readyInMinutes <= coffeeBudget)
      : undefined;

  const primary = nearestCoffee ?? nearestRoom ?? ranked[0];
  if (!primary) {
    return { primary: decorateEmpty(), rest: [] };
  }

  const decorate = (spot: Scored): RankedSpot => {
    const dir =
      origin && hasPoint(spot)
        ? directionsUrl(origin, { lat: spot.lat, lng: spot.lng })
        : undefined;
    const access = isBookable(spot) ? "reservable" : "walk-in";
    const seat = origin
      ? access === "reservable"
        ? `next 15-min slot after a ${spot.walkingMinutes} min walk`
        : `${spot.walkingMinutes} min walk, no booking`
      : access === "reservable"
        ? "next 15-min booking slot; walk time unknown because the starting room is not in the database"
        : "walk-in; walk time unknown because the starting room is not in the database";
    let reason: string;
    if (spot === primary) {
      if (!origin) {
        reason = `Ranked by room fit only (${seat})`;
      } else if (nearestCoffee && spot === nearestCoffee) {
        reason = `Coffee shop ready in ${spot.readyInMinutes} min, within ${prefs.maxExtraWalkingMinutes} extra min of the nearest room`;
      } else if (mode === "now") {
        reason = `Soonest seat: ready in ${spot.readyInMinutes} min (${seat})`;
      } else if (mode === "soon") {
        reason = `Best fit ready within ${tier.waitMinutes} min (${seat})`;
      } else {
        reason = `Best room if you can wait ${spot.readyInMinutes} min (${seat})`;
      }
    } else if (spot.kind === "coffee") {
      reason =
        spot.readyInMinutes > coffeeBudget
          ? `Over the walking budget (${Number.isFinite(coffeeBudget) ? coffeeBudget : "?"} min)`
          : "Coffee shop alternative";
    } else if (access === "reservable") {
      reason = `Reservable, ready in ${spot.readyInMinutes} min — Yale shows live availability on their page`;
    } else {
      reason = `Walk-in, ready in ${spot.readyInMinutes} min`;
    }
    return { ...spot, directionsUrl: dir, reason, access };
  };

  // The tier decides the top pick; remaining spots follow readiness when we have an origin.
  const seen = new Set<string>([primary.name]);
  const rest: RankedSpot[] = [];
  for (const spot of [...scored].sort(origin ? byReady : byQuality)) {
    if (seen.has(spot.name)) continue;
    seen.add(spot.name);
    rest.push(decorate(spot));
  }

  return { primary: decorate(primary), rest };
}

function decorateEmpty(): RankedSpot {
  return {
    kind: "room",
    name: "No reservable rooms loaded",
    walkingMinutes: 0,
    reason: "Import Yale LibCal listings with npm run import:libcal",
    readyInMinutes: 0,
    access: "walk-in",
    quality: 0,
  };
}

import { STUDY_SPOTS } from "@/lib/spots";
import {
  directionsUrl,
  haversineMeters,
  hasPoint,
  walkingMinutes,
  type LatLng,
} from "@/lib/geo";
import type { RoomPrefs, StudyRecommendation } from "@/lib/types";

export type RankedSpot = StudyRecommendation & {
  directionsUrl?: string;
  /** Why this spot was placed where it is. */
  reason: string;
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
    if (!origin || !hasPoint(spot)) return { ...spot };
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
): Recommendation {
  const ranked = withDistances(spots, origin).sort(
    (a, b) =>
      a.walkingMinutes - b.walkingMinutes ||
      (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0),
  );

  const rooms = ranked.filter((s) => s.kind === "room" && isBookable(s));
  const coffee = ranked.filter((s) => s.kind === "coffee");

  const nearestRoom = rooms[0];
  const coffeeBudget = nearestRoom
    ? nearestRoom.walkingMinutes + prefs.maxExtraWalkingMinutes
    : Number.POSITIVE_INFINITY;
  const coffeeAllowed = prefs.includeCoffeeShops && prefs.examUrgency < 0.85;
  const nearestCoffee = coffeeAllowed
    ? coffee.find((shop) => shop.walkingMinutes <= coffeeBudget)
    : undefined;

  const primary = nearestCoffee ?? nearestRoom ?? ranked[0];
  if (!primary) {
    return { primary: decorateEmpty(), rest: [] };
  }

  const decorate = (spot: StudyRecommendation): RankedSpot => {
    const dir =
      origin && hasPoint(spot)
        ? directionsUrl(origin, { lat: spot.lat, lng: spot.lng })
        : undefined;
    let reason: string;
    if (spot === primary) {
      if (nearestCoffee && spot === nearestCoffee) {
        reason = `Closest coffee shop within ${prefs.maxExtraWalkingMinutes} extra min of the nearest reservable room`;
      } else if (isBookable(spot)) {
        reason =
          "Nearest reservable room — Yale shows live availability on their page";
      } else {
        reason = "Nearest listed spot";
      }
    } else if (spot.kind === "coffee") {
      reason =
        spot.walkingMinutes > coffeeBudget
          ? `Over the walking budget (${Number.isFinite(coffeeBudget) ? coffeeBudget : "?"} min)`
          : "Coffee shop alternative";
    } else if (isBookable(spot)) {
      reason =
        spot === nearestRoom
          ? "Nearest reservable room — Yale shows live availability on their page"
          : "Reservable room — Yale shows live availability on their page";
    } else {
      reason = "Listed spot";
    }
    return { ...spot, directionsUrl: dir, reason };
  };

  const seen = new Set<string>([primary.name]);
  const rest: RankedSpot[] = [];
  for (const spot of ranked) {
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
  };
}

import { DEMO_RECOMMENDATIONS } from "@/lib/demo/handsomeDan";
import {
  directionsUrl,
  haversineMeters,
  hasPoint,
  walkingMinutes,
  type LatLng,
} from "@/lib/geo";
import type { RoomPrefs, StudyRecommendation } from "@/lib/types";

const YALE_ROOM_URL = "https://schedule.yale.edu/space/36623";

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

/**
 * Pick where to study.
 *
 * Rule: the nearest bookable Yale room is the baseline. If coffee shops are
 * allowed, exam urgency is not extreme, and a coffee shop is at most
 * `maxExtraWalkingMinutes` further than that room, the nearest such coffee
 * shop wins. Everything else is listed by walking time.
 */
export function recommendSpaces(
  prefs: RoomPrefs,
  origin: LatLng | null,
  spots: StudyRecommendation[] = DEMO_RECOMMENDATIONS,
): Recommendation {
  const ranked = withDistances(spots, origin).sort(
    (a, b) =>
      a.walkingMinutes - b.walkingMinutes ||
      (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0),
  );

  const rooms = ranked.filter((s) => s.kind === "room");
  const coffee = ranked.filter((s) => s.kind === "coffee");

  const nearestRoom =
    rooms[0] ??
    ({
      kind: "room",
      name: "Bass Library Group Study",
      walkingMinutes: 6,
      bookingUrl: YALE_ROOM_URL,
    } satisfies StudyRecommendation);

  const coffeeBudget = nearestRoom.walkingMinutes + prefs.maxExtraWalkingMinutes;
  const coffeeAllowed = prefs.includeCoffeeShops && prefs.examUrgency < 0.85;
  const nearestCoffee = coffeeAllowed
    ? coffee.find((shop) => shop.walkingMinutes <= coffeeBudget)
    : undefined;

  const primary = nearestCoffee ?? nearestRoom;

  const decorate = (spot: StudyRecommendation): RankedSpot => {
    const dir =
      origin && hasPoint(spot)
        ? directionsUrl(origin, { lat: spot.lat, lng: spot.lng })
        : undefined;
    let reason: string;
    if (spot === primary) {
      reason = nearestCoffee
        ? `Closest coffee shop within ${prefs.maxExtraWalkingMinutes} extra min of the nearest room`
        : !prefs.includeCoffeeShops
          ? "Nearest bookable room (coffee shops off)"
          : prefs.examUrgency >= 0.85
            ? "Nearest bookable room (exam urgency is high)"
            : "Nearest bookable room; no coffee shop within the walking budget";
    } else if (spot.kind === "coffee") {
      reason =
        spot.walkingMinutes > coffeeBudget
          ? `Over the walking budget (${coffeeBudget} min)`
          : "Coffee shop alternative";
    } else {
      reason = spot === nearestRoom ? "Nearest bookable room" : "Bookable room";
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

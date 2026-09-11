import type { StudyRecommendation } from "@/lib/types";

/**
 * The study spots the app knows about.
 *
 * This is the single source of truth for capacity, and the server enforces it:
 * a booking can never open more seats than the room actually has, so Bass C10F
 * (one chair) can never become a group pool.
 *
 * `capacitySource` records where the number came from. "schedule.yale.edu" is
 * the capacity published on Yale's Space Availability booking page and is
 * treated as a hard cap. "estimate" is a judgement call about an unreservable
 * room or cafe, and is treated as a suggestion the host may lower.
 *
 * Coordinates are rooftop-accurate to roughly 50 m, which is well inside the
 * resolution of a walking-time estimate.
 */
export type CapacitySource = "schedule.yale.edu" | "estimate";

export type StudySpot = StudyRecommendation & {
  /** Stable slug, used in URLs and as the booking key. */
  id: string;
  capacity: number;
  capacitySource: CapacitySource;
  /** Springshare LibCal space id behind schedule.yale.edu/space/<id>. */
  libcalSpaceId?: number;
  /** Room label exactly as LibCal prints it, e.g. "Bass C10F". */
  libcalLabel?: string;
  /** LibCal location id (`lid`) on schedule.yale.edu. */
  libcalLid?: number;
  /** LibCal group id (`gid`) on schedule.yale.edu. */
  libcalGid?: number;
};

export const STUDY_SPOTS: StudySpot[] = [
  {
    id: "common-grounds",
    kind: "coffee",
    name: "Common Grounds",
    address: "276 York St",
    walkingMinutes: 2,
    lat: 41.31135,
    lng: -72.93155,
    capacity: 8,
    capacitySource: "estimate",
    description:
      "Independent cafe on York Street in the Broadway shops, a short walk from HQ and Cross Campus. Espresso, pastries, and a handful of two-tops plus a window bar. Wifi and some outlets. Fine for a problem-set pair or a coffee meetup; too small and public for a six-person review session.",
    tags: ["coffee", "food", "wifi", "outlets", "background noise", "pair", "york street", "near hq", "meetup"],
  },
  {
    id: "bass-l30a",
    kind: "room",
    name: "Bass Library Group Study L30A",
    address: "110 Wall St",
    walkingMinutes: 4,
    bookingUrl: "https://schedule.yale.edu/space/113265",
    libcalSpaceId: 113265,
    libcalLabel: "Bass L30A",
    libcalLid: 9058,
    libcalGid: 32401,
    lat: 41.3109,
    lng: -72.928,
    capacity: 6,
    capacitySource: "schedule.yale.edu",
    description:
      "Reservable group study room on the lower level of Bass. Seats six, with power, wireless, an LCD display and laptop connectors, and a portable whiteboard you can roll in. Enclosed enough to talk through a pset. Food is not allowed. Book at schedule.yale.edu; Yale ID to swipe in.",
    tags: ["group", "whiteboard", "monitor", "quiet", "enclosed", "reservable", "central campus", "no food", "bass"],
  },
  {
    id: "bass-c10f",
    kind: "room",
    name: "Bass Library C10F",
    address: "110 Wall St",
    walkingMinutes: 4,
    bookingUrl: "https://schedule.yale.edu/space/128473",
    libcalSpaceId: 128473,
    libcalLabel: "Bass C10F",
    libcalLid: 9058,
    libcalGid: 32401,
    lat: 41.31095,
    lng: -72.9279,
    capacity: 1,
    capacitySource: "schedule.yale.edu",
    description:
      "ADA-accessible individual study room on the courtyard level of Bass, facing Thain Cafe. One desk with a lamp, power, and wireless. Students may book up to four hours once per day. Strictly solo — do not use this for a group.",
    tags: ["solo", "quiet", "enclosed", "reservable", "outlets", "private", "accessible", "central campus", "bass"],
  },
  {
    id: "sterling-reading-room",
    kind: "room",
    name: "Sterling Memorial Library Reading Room",
    address: "120 High St",
    walkingMinutes: 5,
    lat: 41.3112,
    lng: -72.9288,
    capacity: 40,
    capacitySource: "estimate",
    description:
      "The long oak reading room off the Sterling nave. Big shared tables, lamps, high ceilings, and an unwritten rule of near-silence. Walk-in, never reservable. Excellent for parallel solo work next to classmates; useless for a discussion you need to have out loud.",
    tags: ["silent", "quiet", "walk-in", "no booking", "tables", "grand", "central campus", "sterling", "solo"],
  },
  {
    id: "marx-library",
    kind: "room",
    name: "Marx Science and Social Science Library",
    address: "219 Prospect St",
    walkingMinutes: 12,
    lat: 41.3179,
    lng: -72.922,
    capacity: 30,
    capacitySource: "estimate",
    description:
      "Ground floor of Kline Tower on Science Hill. Open tables, carrels, whiteboards, and a café upstairs. Talking is tolerated at a low volume. The obvious choice if your class already meets on Science Hill, and a long uphill walk if it does not.",
    tags: ["group", "whiteboard", "walk-in", "no booking", "science hill", "outlets", "cafe", "kline"],
  },
  {
    id: "atticus",
    kind: "coffee",
    name: "Atticus Bookstore Cafe",
    address: "1082 Chapel St",
    walkingMinutes: 7,
    lat: 41.3084,
    lng: -72.9305,
    capacity: 10,
    capacitySource: "estimate",
    description:
      "Bookstore cafe on Chapel Street across from the Art Gallery. Counter seating, a long communal table, soup and bread. Busy and loud at lunch, workable mid-afternoon. The natural meetup if your class is at YUAG or on lower Chapel.",
    tags: ["coffee", "food", "books", "communal table", "chapel street", "near yuag", "meetup", "background noise"],
  },
  {
    id: "book-trader",
    kind: "coffee",
    name: "Book Trader Cafe",
    address: "1140 Chapel St",
    walkingMinutes: 8,
    lat: 41.3079,
    lng: -72.9288,
    capacity: 12,
    capacitySource: "estimate",
    description:
      "Used-bookstore cafe with a back room of mismatched tables and a courtyard when it is warm. Quieter than Atticus and more forgiving of a group that wants to spread out papers. Sandwiches, drip coffee, patchy outlets.",
    tags: ["coffee", "food", "quiet", "group", "courtyard", "books", "chapel street", "meetup"],
  },
];

export function findSpot(nameOrId: string): StudySpot | undefined {
  const needle = nameOrId.trim().toLowerCase();
  if (!needle) return undefined;
  return STUDY_SPOTS.find(
    (s) => s.id === needle || s.name.toLowerCase() === needle,
  );
}

export function findSpotByLibcalSpaceId(spaceId: number): StudySpot | undefined {
  if (!Number.isFinite(spaceId) || spaceId <= 0) return undefined;
  return STUDY_SPOTS.find((s) => s.libcalSpaceId === spaceId);
}

/** Hard ceiling for an unrecognised spot, so a typo cannot open a 500-seat pool. */
export const UNKNOWN_SPOT_MAX_CAPACITY = 8;

export type CapacityRuling = {
  capacity: number;
  /** Set when the request was reduced, for the UI to explain. */
  note?: string;
};

/**
 * Decide how many seats a booking may open.
 *
 * A published Yale capacity wins outright — asking for four seats in a
 * one-person room yields one seat, not four. Estimated capacities and unknown
 * spots let the host pick anything up to the estimate.
 */
export function resolveBookingCapacity(
  spotName: string,
  requested: number,
): CapacityRuling {
  const wanted = Number.isFinite(requested) ? Math.floor(requested) : 1;
  const spot = findSpot(spotName);

  if (!spot) {
    const capacity = Math.min(Math.max(1, wanted), UNKNOWN_SPOT_MAX_CAPACITY);
    return capacity === wanted
      ? { capacity }
      : {
          capacity,
          note: `Capped at ${capacity} because this spot is not in the study-spot list.`,
        };
  }

  if (spot.capacitySource === "schedule.yale.edu") {
    const capacity = Math.min(Math.max(1, wanted), spot.capacity);
    return capacity === wanted
      ? { capacity }
      : {
          capacity,
          note: `${spot.name} seats ${spot.capacity} on schedule.yale.edu, so the pool caps at ${capacity}.`,
        };
  }

  const capacity = Math.min(Math.max(1, wanted), spot.capacity);
  return capacity === wanted
    ? { capacity }
    : {
        capacity,
        note: `${spot.name} comfortably fits about ${spot.capacity}, so the pool caps at ${capacity}.`,
      };
}

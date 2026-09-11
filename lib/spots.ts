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
  /** Human-readable opening hours, when known. */
  hours?: string;
};

/**
 * Order matters only for ties. The first seven entries are the original
 * hand-checked set; the rest were added from schedule.yale.edu's location
 * list (Bass, Marx, Sterling, Haas, 17 Hillhouse, Rosenkranz), Yale Library's
 * "Places to Study" page, and a survey of cafes within a walk of campus.
 * Blue State Coffee closed in 2022; both campus locations are now Common
 * Grounds. Space id 36623 is Marx C20A, not a Bass room.
 */
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
    lat: 41.30795,
    lng: -72.93064,
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
    lat: 41.30848,
    lng: -72.93228,
    capacity: 12,
    capacitySource: "estimate",
    description:
      "Used-bookstore cafe with a back room of mismatched tables and a courtyard when it is warm. Quieter than Atticus and more forgiving of a group that wants to spread out papers. Sandwiches, drip coffee, patchy outlets.",
    tags: ["coffee", "food", "quiet", "group", "courtyard", "books", "chapel street", "meetup"],
  },
  {
    id: "marx-c20a",
    kind: "room",
    name: "Marx Study Room C20A",
    address: "Kline Tower, 219 Prospect St",
    walkingMinutes: 8,
    lat: 41.31724,
    lng: -72.92255,
    capacity: 4,
    capacitySource: "schedule.yale.edu",
    bookingUrl: "https://schedule.yale.edu/space/36623",
    libcalSpaceId: 36623,
    libcalLabel: "Study Room C20A (Main Level)",
    hours: "24/7 with Yale ID",
    description: "Reservable Marx Library study room on the concourse level inside the Young Family Study Room. Table for four, one whiteboard, power at the table. Science Hill's go-to for a problem set with a partner.",
    tags: ["group", "whiteboard", "outlets", "science hill", "reservable", "stem", "small"],
  },
  {
    id: "marx-c20b",
    kind: "room",
    name: "Marx Study Room C20B",
    address: "Kline Tower, 219 Prospect St",
    walkingMinutes: 8,
    lat: 41.31724,
    lng: -72.92255,
    capacity: 2,
    capacitySource: "schedule.yale.edu",
    bookingUrl: "https://schedule.yale.edu/reserve/spaces/marx",
    hours: "24/7 with Yale ID",
    description: "Two-person Marx study room with a whiteboard. Perfect for a pair reviewing notes or a tutoring session near Science Hill.",
    tags: ["pair", "whiteboard", "quiet", "science hill", "reservable", "tutoring", "private"],
  },
  {
    id: "marx-c20c",
    kind: "room",
    name: "Marx Study Room C20C",
    address: "Kline Tower, 219 Prospect St",
    walkingMinutes: 8,
    lat: 41.31724,
    lng: -72.92255,
    capacity: 5,
    capacitySource: "schedule.yale.edu",
    bookingUrl: "https://schedule.yale.edu/space/36625",
    libcalSpaceId: 36625,
    libcalLabel: "Study Room C20C (Main Level)",
    hours: "24/7 with Yale ID",
    description: "Five-seat Marx study room with two whiteboards, the most board space of the small rooms. Good for a lab group working a derivation together.",
    tags: ["group", "whiteboard", "outlets", "science hill", "reservable", "stem", "lab group"],
  },
  {
    id: "marx-c49",
    kind: "room",
    name: "Marx Study Room C49",
    address: "Kline Tower, 219 Prospect St",
    walkingMinutes: 8,
    lat: 41.31724,
    lng: -72.92255,
    capacity: 4,
    capacitySource: "schedule.yale.edu",
    bookingUrl: "https://schedule.yale.edu/reserve/spaces/marx",
    hours: "24/7 with Yale ID",
    description: "Marx study room with presentation technology: plug in a laptop and rehearse slides for four. Also C33 and C48 nearby with whiteboards.",
    tags: ["group", "monitor", "presentation", "science hill", "reservable", "practice talk"],
  },
  {
    id: "marx-s57",
    kind: "room",
    name: "Marx Seminar Room S57",
    address: "Kline Tower, 219 Prospect St",
    walkingMinutes: 8,
    lat: 41.31724,
    lng: -72.92255,
    capacity: 12,
    capacitySource: "schedule.yale.edu",
    bookingUrl: "https://schedule.yale.edu/reserve/spaces/marx",
    hours: "Library hours",
    description: "Twelve-person seminar room on the lower level of Marx with a large wireless display. The right size for a club exec meeting or a section review.",
    tags: ["large", "group", "monitor", "science hill", "reservable", "club", "seminar", "meeting"],
  },
  {
    id: "bass-courtyard-level",
    kind: "room",
    name: "Bass Courtyard Level",
    address: "110 Wall St",
    walkingMinutes: 8,
    lat: 41.3109,
    lng: -72.928,
    capacity: 80,
    capacitySource: "estimate",
    hours: "Library hours",
    description: "Open study floor at Bass with natural light and varied seating, steps from Cross Campus. Walk in; the individual rooms here are first-come. Thain Café is right there.",
    tags: ["open", "natural light", "walk-in", "central campus", "coffee nearby", "busy", "outlets"],
  },
  {
    id: "bass-lower-level",
    kind: "room",
    name: "Bass Lower Level",
    address: "110 Wall St",
    walkingMinutes: 8,
    lat: 41.3109,
    lng: -72.928,
    capacity: 80,
    capacitySource: "estimate",
    hours: "Library hours",
    description: "The quieter Bass floor with soft seating and high-top tables. Walk in. Good for solo reading when Sterling feels too formal.",
    tags: ["quiet", "walk-in", "solo", "soft seating", "central campus", "outlets"],
  },
  {
    id: "sterling-group-study-room",
    kind: "room",
    name: "Sterling Group Study Room",
    address: "120 High St",
    walkingMinutes: 8,
    lat: 41.31146,
    lng: -72.92894,
    capacity: 12,
    capacitySource: "estimate",
    bookingUrl: "https://schedule.yale.edu/spaces?lid=9060",
    hours: "Library hours",
    description: "Three reservable meeting rooms off the Wright Reading Room on Sterling's lower level. Tables for 10-12, blackboards, and an LCD projector for a laptop. Needs two or more Yale people.",
    tags: ["large", "group", "blackboard", "projector", "reservable", "central campus", "club", "meeting", "presentation"],
  },
  {
    id: "sterling-starr-reference-room",
    kind: "room",
    name: "Sterling Starr Reference Room",
    address: "120 High St",
    walkingMinutes: 8,
    lat: 41.31146,
    lng: -72.92894,
    capacity: 1,
    capacitySource: "estimate",
    hours: "Library hours",
    description: "Large public quiet reading room on Sterling's ground floor with the reference collection. Slightly less hushed than the Nave, more table space.",
    tags: ["quiet", "solo", "reading", "reference", "walk-in", "central campus", "writing"],
  },
  {
    id: "sterling-linonia-brothers-room",
    kind: "room",
    name: "Sterling Linonia & Brothers Room",
    address: "120 High St",
    walkingMinutes: 8,
    lat: 41.31146,
    lng: -72.92894,
    capacity: 1,
    capacitySource: "estimate",
    hours: "Library hours",
    description: "Recently renovated room in Sterling with soft seating and reading nooks. The cozy option for reading a novel for a seminar.",
    tags: ["cozy", "soft seating", "reading", "quiet", "beautiful", "walk-in", "humanities"],
  },
  {
    id: "haas-arts-library-group-study-room",
    kind: "room",
    name: "Haas Arts Library Group Study Room",
    address: "180 York St",
    walkingMinutes: 8,
    lat: 41.30877,
    lng: -72.93189,
    capacity: 6,
    capacitySource: "estimate",
    bookingUrl: "https://schedule.yale.edu/spaces?lid=5726",
    hours: "Library hours",
    description: "Reservable group rooms at the Arts Library for 2-6 with wall-mounted flat screens and whiteboards. Quiet building on the arts side of campus, near Chapel Street cafes.",
    tags: ["group", "monitor", "whiteboard", "reservable", "quiet", "arts", "chapel street", "presentation"],
  },
  {
    id: "17-hillhouse-classroom",
    kind: "room",
    name: "17 Hillhouse Classroom",
    address: "17 Hillhouse Ave",
    walkingMinutes: 8,
    lat: 41.31276,
    lng: -72.92346,
    capacity: 20,
    capacitySource: "estimate",
    bookingUrl: "https://schedule.yale.edu/reserve/spaces/17hillhouse",
    hours: "Building hours",
    description: "Library-managed classrooms at 17 Hillhouse, reservable for 13 or more. The move for a club meeting or a big review session between Science Hill and Old Campus.",
    tags: ["large", "club", "classroom", "reservable", "meeting", "review session", "whiteboard"],
  },
  {
    id: "rosenkranz-hall-classroom",
    kind: "room",
    name: "Rosenkranz Hall Classroom",
    address: "115 Prospect St",
    walkingMinutes: 8,
    lat: 41.3147,
    lng: -72.92455,
    capacity: 20,
    capacitySource: "estimate",
    bookingUrl: "https://schedule.yale.edu/reserve/spaces/rkz",
    hours: "Building hours",
    description: "Reservable classrooms in Rosenkranz Hall for groups of 13 or more. Good for a section-wide study session or an org meeting on Prospect Street.",
    tags: ["large", "club", "classroom", "reservable", "meeting", "review session"],
  },
  {
    id: "ceid-study-space",
    kind: "room",
    name: "CEID Study Space",
    address: "15 Prospect St",
    walkingMinutes: 8,
    lat: 41.31267,
    lng: -72.92512,
    capacity: 10,
    capacitySource: "estimate",
    hours: "Members 24/7; public weekdays",
    description: "Open collaborative space in the Center for Engineering Innovation and Design with standing tables, whiteboards, 3D printers, and tools. Noisy and social. Good for a project team building something. Members only after hours.",
    tags: ["group", "collaborative", "whiteboard", "makerspace", "loud", "project", "prototyping", "engineering", "standing desks", "near davies", "walk-in"],
  },
  {
    id: "humanities-quadrangle-study-room",
    kind: "room",
    name: "Humanities Quadrangle Study Room",
    address: "320 York St",
    walkingMinutes: 8,
    lat: 41.31231,
    lng: -72.92913,
    capacity: 4,
    capacitySource: "estimate",
    hours: "Building hours",
    description: "Small seminar-style rooms in the Humanities Quadrangle with a round table, a whiteboard, and courtyard windows. Quiet and private. First-come for students.",
    tags: ["group", "small", "whiteboard", "quiet", "private", "seminar", "humanities", "discussion", "window", "essays", "walk-in"],
  },
  {
    id: "cushing-whitney-medical-library",
    kind: "room",
    name: "Cushing/Whitney Medical Library",
    address: "333 Cedar St",
    walkingMinutes: 8,
    lat: 41.303,
    lng: -72.93324,
    capacity: 30,
    capacitySource: "estimate",
    hours: "24/7 with Yale ID",
    description: "Medical campus library with 24-hour access, some reservable rooms, and the silent Morse Reading Room. A long walk from central campus but nearly empty of undergrads.",
    tags: ["quiet", "silent", "24/7", "medical campus", "far", "empty", "solo", "reading"],
  },
  {
    id: "divinity-library-day-missions-reading-room",
    kind: "room",
    name: "Divinity Library Day Missions Reading Room",
    address: "409 Prospect St",
    walkingMinutes: 8,
    lat: 41.32339,
    lng: -72.92131,
    capacity: 1,
    capacitySource: "estimate",
    hours: "Library hours",
    description: "Majestic two-story reading room at the Divinity School, quiet and rarely crowded. Worth the walk up Prospect for a long, distraction-free afternoon.",
    tags: ["quiet", "beautiful", "solo", "reading", "far", "empty", "natural light", "walk-in", "prospect hill"],
  },
  {
    id: "thain-family-caf",
    kind: "coffee",
    name: "Thain Family Café",
    address: "Bass Library, 110 Wall St",
    walkingMinutes: 8,
    lat: 41.3108,
    lng: -72.9281,
    capacity: 6,
    capacitySource: "estimate",
    hours: "Library hours",
    description: "The café inside Bass Library with high tables you can reserve and coffee steps from the stacks. Study with a latte without leaving the library.",
    tags: ["coffee", "food", "inside library", "high tables", "central campus", "outlets", "reservable", "busy"],
  },
  {
    id: "common-grounds-wall",
    kind: "coffee",
    name: "Common Grounds (Wall St)",
    address: "84 Wall St",
    walkingMinutes: 8,
    lat: 41.31038,
    lng: -72.92558,
    capacity: 4,
    capacitySource: "estimate",
    hours: "7am-9pm",
    description: "Campus coffee shop in the old Blue State spot, steps from Cross Campus and Bass. Big communal tables, plenty of outlets, loud during rush. Fine for a pair on laptops.",
    tags: ["coffee", "food", "wifi", "outlets", "loud", "communal tables", "central campus", "laptops"],
  },
  {
    id: "koffee",
    kind: "coffee",
    name: "Koffee?",
    address: "104 Audubon St",
    walkingMinutes: 8,
    lat: 41.31155,
    lng: -72.92191,
    capacity: 3,
    capacitySource: "estimate",
    hours: "7am-6pm",
    description: "Cozy neighborhood cafe near Science Hill and the engineering buildings. Great espresso, pastries, and a lively hum of chatter. Some outlets along the wall; wifi is decent. Good for reading or light solo work.",
    tags: ["coffee", "food", "wifi", "outlets", "background noise", "solo", "near science hill", "cozy"],
  },
  {
    id: "atticus-bookstore-cafe",
    kind: "coffee",
    name: "Atticus Bookstore Cafe",
    address: "1082 Chapel St",
    walkingMinutes: 8,
    lat: 41.3082,
    lng: -72.9301,
    capacity: 4,
    capacitySource: "estimate",
    hours: "7am-9pm",
    description: "Bookstore cafe on Chapel Street since 1975 with soup, sandwiches, and bread. Warm and relatively calm in the afternoon. Limited outlets. Nice for reading or writing an essay over a long lunch.",
    tags: ["coffee", "food", "lunch", "calm", "reading", "writing", "bookstore", "limited outlets", "chapel street"],
  },
  {
    id: "book-trader-cafe",
    kind: "coffee",
    name: "Book Trader Cafe",
    address: "1140 Chapel St",
    walkingMinutes: 8,
    lat: 41.308,
    lng: -72.9312,
    capacity: 4,
    capacitySource: "estimate",
    hours: "9am-7pm",
    description: "Used bookstore and cafe a block down Chapel from Atticus, with an indoor solarium, lots of natural light, free wifi, and outdoor seating among the shelves. Closes early evening.",
    tags: ["coffee", "food", "wifi", "natural light", "bookstore", "reading", "writing", "chapel street", "outdoor"],
  },
  {
    id: "willoughby-s-coffee-tea",
    kind: "coffee",
    name: "Willoughby's Coffee & Tea",
    address: "194 York St",
    walkingMinutes: 8,
    lat: 41.30896,
    lng: -72.93166,
    capacity: 2,
    capacitySource: "estimate",
    hours: "7am-6pm",
    description: "New Haven's roaster since 1985. Excellent pour-over, few seats and few outlets, so best for a quick caffeine stop or a short one-on-one meeting.",
    tags: ["coffee", "tea", "quick", "small", "meeting", "few seats", "no outlets"],
  },
  {
    id: "poindexter-coffee",
    kind: "coffee",
    name: "Poindexter Coffee",
    address: "1151 Chapel St (Graduate hotel)",
    walkingMinutes: 8,
    lat: 41.3088,
    lng: -72.9326,
    capacity: 6,
    capacitySource: "estimate",
    hours: "6:30am-6pm",
    description: "Hotel-lobby cafe inside the Graduate by Hilton with generous study seating, breakfast, and a calmer vibe than the student cafes. Reliable outlets.",
    tags: ["coffee", "food", "wifi", "outlets", "calm", "lobby", "chapel street", "laptops", "spacious"],
  },
  {
    id: "olmo",
    kind: "coffee",
    name: "Olmo",
    address: "93 Whitney Ave",
    walkingMinutes: 8,
    lat: 41.31195,
    lng: -72.92222,
    capacity: 3,
    capacitySource: "estimate",
    hours: "7am-3pm",
    description: "New Haven-style bagel shop with a serious coffee program and cold brew. Quick and close to Hillhouse and Audubon; better for a breakfast meeting than a long session.",
    tags: ["coffee", "food", "bagels", "quick", "breakfast", "whitney ave", "near science hill", "meeting"],
  },
  {
    id: "motw-coffee-and-pastries",
    kind: "coffee",
    name: "MOTW Coffee and Pastries",
    address: "296 Crown St",
    walkingMinutes: 8,
    lat: 41.30649,
    lng: -72.93109,
    capacity: 4,
    capacitySource: "estimate",
    hours: "8am-8pm",
    description: "Bright specialty coffee and Arabic pastry cafe downtown with housemade chai. Welcoming for laptops, a few blocks south of Chapel.",
    tags: ["coffee", "food", "chai", "bright", "wifi", "downtown", "laptops", "calm"],
  },
  {
    id: "arwa-yemeni-coffee",
    kind: "coffee",
    name: "Arwa Yemeni Coffee",
    address: "335 Orange St",
    walkingMinutes: 8,
    lat: 41.31126,
    lng: -72.91975,
    capacity: 4,
    capacitySource: "estimate",
    hours: "8am-midnight",
    description: "Yemeni coffee house with spiced drinks and honey bread and a dedicated study-friendly room. Open late, near the Green and the Law School.",
    tags: ["coffee", "tea", "food", "late night", "study room", "wifi", "downtown", "calm"],
  },
  {
    id: "cafe-romeo",
    kind: "coffee",
    name: "Cafe Romeo",
    address: "534 Orange St",
    walkingMinutes: 8,
    lat: 41.3149,
    lng: -72.91745,
    capacity: 4,
    capacitySource: "estimate",
    hours: "7am-6pm",
    description: "East Rock neighborhood cafe with pastries, sandwiches, and a loyal grad-student crowd. Longer walk from campus; quieter on weekday afternoons.",
    tags: ["coffee", "food", "east rock", "wifi", "calm", "grad students", "far"],
  },
  {
    id: "the-coffee-pedaler",
    kind: "coffee",
    name: "The Coffee Pedaler",
    address: "605 East St",
    walkingMinutes: 8,
    lat: 41.31601,
    lng: -72.90875,
    capacity: 3,
    capacitySource: "estimate",
    hours: "7am-4pm",
    description: "Specialty cafe east of downtown known for careful espresso and pour-over, welcoming to laptop workers. A real walk from central campus.",
    tags: ["coffee", "specialty", "wifi", "laptops", "calm", "far", "east rock"],
  },
  {
    id: "ero-cafe",
    kind: "coffee",
    name: "ERO Cafe",
    address: "44 Olive St",
    walkingMinutes: 8,
    lat: 41.30294,
    lng: -72.92069,
    capacity: 3,
    capacitySource: "estimate",
    hours: "8am-4pm",
    description: "Wooster Square cafe next to Sally's with creative matcha drinks and breakfast. Cozy, small; better for a break than a marathon.",
    tags: ["coffee", "matcha", "food", "wooster square", "small", "cozy", "far"],
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

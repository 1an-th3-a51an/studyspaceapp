/**
 * Karma: a lightweight, device-local credit score that nudges people toward
 * sharing rooms instead of hoarding them.
 *
 * Earn karma for pooling (hosting, joining, getting matched), for announcing
 * a booking so others can join, and for releasing a room you no longer need.
 * Lose karma for booking heavily in one day. Everything lives in localStorage
 * on this device; nothing is sent to a server. It is a nudge, not a gate.
 */

export type KarmaEventKind =
  | "pool-host"
  | "pool-join"
  | "queue-match"
  | "booking-announce"
  | "booking-join"
  | "booking-release"
  | "booking-heavy"
  | "invite-partner";

export type KarmaEvent = {
  id: string;
  kind: KarmaEventKind;
  delta: number;
  note: string;
  at: string; // ISO
};

export type KarmaState = {
  score: number;
  events: KarmaEvent[];
};

export const KARMA_STORAGE_KEY = "studyspace.karma";
export const KARMA_START = 20;
/** Bookings per day before each additional one costs karma. */
export const HEAVY_BOOKING_THRESHOLD = 2;

export const KARMA_RULES: { kind: KarmaEventKind; delta: number; label: string }[] = [
  { kind: "pool-host", delta: 5, label: "Host a study pool" },
  { kind: "pool-join", delta: 3, label: "Join someone's pool" },
  { kind: "queue-match", delta: 4, label: "Get matched in the live queue" },
  { kind: "booking-announce", delta: 2, label: "Announce a booking so others can join" },
  { kind: "booking-join", delta: 2, label: "Join a room someone else booked" },
  { kind: "booking-release", delta: 6, label: "Release a room you no longer need" },
  { kind: "invite-partner", delta: 2, label: "Invite a writing or study partner" },
  {
    kind: "booking-heavy",
    delta: -4,
    label: `Each booking beyond ${HEAVY_BOOKING_THRESHOLD} in one day`,
  },
];

const MAX_EVENTS = 100;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readKarma(): KarmaState {
  if (!canUseStorage()) return { score: KARMA_START, events: [] };
  try {
    const raw = localStorage.getItem(KARMA_STORAGE_KEY);
    if (!raw) return { score: KARMA_START, events: [] };
    const parsed = JSON.parse(raw) as Partial<KarmaState>;
    return {
      score: typeof parsed.score === "number" ? parsed.score : KARMA_START,
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { score: KARMA_START, events: [] };
  }
}

function writeKarma(state: KarmaState) {
  if (!canUseStorage()) return;
  localStorage.setItem(KARMA_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("studyspace:karma", { detail: state }));
}

export function ruleFor(kind: KarmaEventKind) {
  return KARMA_RULES.find((r) => r.kind === kind)!;
}

/** Record an event and return the new state. `note` is what the ledger shows. */
export function awardKarma(kind: KarmaEventKind, note?: string): KarmaState {
  const rule = ruleFor(kind);
  const current = readKarma();
  const event: KarmaEvent = {
    id: crypto.randomUUID(),
    kind,
    delta: rule.delta,
    note: note ?? rule.label,
    at: new Date().toISOString(),
  };
  const next: KarmaState = {
    score: Math.max(0, current.score + rule.delta),
    events: [event, ...current.events].slice(0, MAX_EVENTS),
  };
  writeKarma(next);
  return next;
}

/** Bookings this device has made today, from the ledger. */
export function bookingsToday(state = readKarma(), now = new Date()): number {
  const day = now.toDateString();
  return state.events.filter(
    (e) =>
      (e.kind === "booking-announce" || e.kind === "booking-heavy") &&
      new Date(e.at).toDateString() === day,
  ).filter((e) => e.kind === "booking-announce").length;
}

/**
 * Call when the user books a room. Awards the announce credit and, if this
 * pushes them over the daily threshold, the heavy-booking penalty too.
 */
export function recordBooking(spotName: string): KarmaState {
  const before = bookingsToday();
  let state = awardKarma("booking-announce", `Announced ${spotName}`);
  if (before + 1 > HEAVY_BOOKING_THRESHOLD) {
    state = awardKarma(
      "booking-heavy",
      `Booking #${before + 1} today (${spotName})`,
    );
  }
  return state;
}

export type KarmaTier = {
  name: string;
  min: number;
  blurb: string;
};

export const KARMA_TIERS: KarmaTier[] = [
  { name: "Room hog", min: 0, blurb: "Release a room or join a pool to climb." },
  { name: "Neutral", min: 10, blurb: "Book what you use." },
  { name: "Good neighbor", min: 30, blurb: "You share rooms. People notice." },
  { name: "Handsome Dan tier", min: 60, blurb: "Campus study legend." },
];

export function tierFor(score: number): KarmaTier {
  let tier = KARMA_TIERS[0];
  for (const t of KARMA_TIERS) if (score >= t.min) tier = t;
  return tier;
}

export function nextTier(score: number): KarmaTier | null {
  return KARMA_TIERS.find((t) => t.min > score) ?? null;
}

import type { StudyRecommendation } from "@/lib/types";

/**
 * Activity meter: how busy a spot probably is right now.
 *
 * Yale publishes no live occupancy feed, so this is an estimate from a
 * time-of-day curve per venue type, nudged by the spot's tags and by any live
 * bookings the app itself knows about. It is labeled as an estimate wherever
 * it is shown. Swap `estimateActivity` for a real feed when one exists.
 */

export type ActivityLevel = "quiet" | "moderate" | "busy" | "packed";

export type ActivityEstimate = {
  /** 0..1 */
  value: number;
  level: ActivityLevel;
  label: string;
  /** Why the number is what it is, for a tooltip. */
  detail: string;
  source: "estimate" | "estimate+live";
};

function libraryCurve(hour: number, weekend: boolean): number {
  // Libraries: dead early, ramp through the afternoon, second peak at night.
  const base =
    hour < 8 ? 0.08 :
    hour < 10 ? 0.25 :
    hour < 13 ? 0.45 :
    hour < 17 ? 0.7 :
    hour < 19 ? 0.5 :
    hour < 23 ? 0.75 :
    0.2;
  return weekend ? base * 0.7 : base;
}

function cafeCurve(hour: number, weekend: boolean): number {
  // Cafes: morning rush, lunch, afternoon laptops, empty by dinner.
  const base =
    hour < 7 ? 0.05 :
    hour < 9 ? 0.55 :
    hour < 11 ? 0.8 :
    hour < 13 ? 0.65 :
    hour < 16 ? 0.7 :
    hour < 18 ? 0.4 :
    hour < 20 ? 0.2 :
    0.05;
  return weekend ? Math.min(1, base * 1.15) : base;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function levelFor(value: number): ActivityLevel {
  if (value < 0.3) return "quiet";
  if (value < 0.55) return "moderate";
  if (value < 0.8) return "busy";
  return "packed";
}

const LABELS: Record<ActivityLevel, string> = {
  quiet: "Quiet now",
  moderate: "Some seats",
  busy: "Filling up",
  packed: "Packed",
};

export function estimateActivity(
  spot: StudyRecommendation,
  now: Date = new Date(),
  liveBookingsNearby = 0,
): ActivityEstimate {
  const hour = now.getHours() + now.getMinutes() / 60;
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const tags = new Set((spot.tags ?? []).map((t) => t.toLowerCase()));

  let value = spot.kind === "coffee" ? cafeCurve(hour, weekend) : libraryCurve(hour, weekend);
  const notes: string[] = [spot.kind === "coffee" ? "cafe rhythm" : "library rhythm"];

  if (tags.has("busy")) {
    value += 0.15;
    notes.push("usually crowded");
  }
  if (tags.has("empty") || tags.has("far")) {
    value -= 0.2;
    notes.push("off the beaten path");
  }
  if (tags.has("makerspace") || tags.has("loud")) {
    value += 0.05;
  }
  if (tags.has("24/7") && (hour >= 23 || hour < 8)) {
    value = Math.max(value, 0.25);
    notes.push("open all night");
  }
  if (tags.has("reservable") && spot.kind === "room") {
    // A bookable room is either yours or someone else's; the curve matters less.
    value = value * 0.8;
  }

  let source: ActivityEstimate["source"] = "estimate";
  if (liveBookingsNearby > 0) {
    value += Math.min(0.3, liveBookingsNearby * 0.1);
    notes.push(`${liveBookingsNearby} announced booking${liveBookingsNearby === 1 ? "" : "s"} here soon`);
    source = "estimate+live";
  }

  value = clamp01(value);
  const level = levelFor(value);
  return {
    value,
    level,
    label: LABELS[level],
    detail: `Estimated from ${notes.join(", ")}. Yale has no public live counter.`,
    source,
  };
}

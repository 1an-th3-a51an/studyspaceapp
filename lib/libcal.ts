import type { StudySpot } from "@/lib/spots";

/**
 * Deep links into Yale's Space Availability site (schedule.yale.edu / LibCal).
 *
 * LibCal space pages accept a `date` query (`YYYY-MM-DD` in America/New_York).
 * That is enough to land on the right day. Live green/red cells are Yale's
 * to show — this app does not scrape or click the grid.
 *
 * `LIBCAL_GRID_MINUTES` is LibCal's slot granularity (Yale Library uses 15).
 * Starts are snapped down so a datetime-local picker lines up with the grid
 * the student will see.
 */
export const LIBCAL_GRID_MINUTES = 15;

export const YALE_SPACE_TIMEZONE = "America/New_York";

export type SlotRequest = {
  /** ISO start the host picked. */
  startIso: string;
  /** Room label as LibCal prints it, e.g. "Bass C10F". */
  roomLabel: string;
  /** LibCal space id, when the spot is reservable. */
  spaceId?: number;
  /** Base room page, used when there is no space id to build a link from. */
  bookingUrl?: string;
};

function parts(startIso: string): Record<string, string> {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return {};
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: YALE_SPACE_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
}

/** Round down to LibCal's grid so the start lines up with a block. */
export function snapToGrid(startIso: string): string {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return startIso;
  const stepMs = LIBCAL_GRID_MINUTES * 60 * 1000;
  return new Date(Math.floor(date.getTime() / stepMs) * stepMs).toISOString();
}

/** `2026-09-11` in New Haven's timezone, which is what LibCal's `date` param uses. */
export function yaleDateKey(startIso: string): string {
  const p = parts(startIso);
  if (!p.year) return "";
  const monthIndex = new Date(`${p.month} 1, 2000`).getMonth() + 1;
  return `${p.year}-${String(monthIndex).padStart(2, "0")}-${p.day.padStart(2, "0")}`;
}

/** The URL that opens the room's Yale page on the requested day. */
export function slotDeepLink(request: SlotRequest): string | undefined {
  const base =
    request.bookingUrl ??
    (request.spaceId ? `https://schedule.yale.edu/space/${request.spaceId}` : undefined);
  if (!base) return undefined;

  const date = yaleDateKey(request.startIso);
  const url = new URL(base);
  if (date) url.searchParams.set("date", date);
  return url.toString();
}

/** Build a slot request straight from a spot in the registry. */
export function slotRequestForSpot(
  spot: Pick<StudySpot, "name" | "bookingUrl" | "libcalSpaceId" | "libcalLabel">,
  startIso: string,
): SlotRequest {
  return {
    startIso: snapToGrid(startIso),
    roomLabel: spot.libcalLabel ?? spot.name,
    spaceId: spot.libcalSpaceId,
    bookingUrl: spot.bookingUrl,
  };
}

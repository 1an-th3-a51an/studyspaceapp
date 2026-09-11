import type { StudySpot } from "@/lib/spots";

/**
 * Deep links into Yale's Space Availability site (schedule.yale.edu), which
 * runs Springshare LibCal.
 *
 * LibCal's space pages accept a `date` parameter. A `#studyspaceStart=` hash
 * names the start we want; the page itself ignores it, but Autofill's
 * bookmarklet / userscript reads it and clicks a green cell.
 *
 * Green (`s-lc-eq-avail`, or a grid slot with no class) is bookable. Red
 * (`s-lc-eq-checkout`, `s-lc-eq-period-booked`) is already taken. Padding
 * (`s-lc-eq-r-unavailable`) is not a slot. Autofill never clicks red: if the
 * requested start is booked or missing, it takes the earliest remaining green
 * cell at or after that time.
 *
 * `LIBCAL_GRID_MINUTES` is LibCal's slot granularity (Yale Library uses 15).
 * A start that is not on the grid can never match a green block, so requests
 * are rounded down.
 *
 * After a green cell is clicked it turns yellow (class `s-lc-eq-pending` /
 * checkout) and LibCal writes:
 *   Bass C10F: 1:00pm Friday, September 11, 2026 until...
 * The end-time dropdown is left alone; Yale keeps its default length.
 */
export const LIBCAL_GRID_MINUTES = 15;

export const YALE_SPACE_TIMEZONE = "America/New_York";

export type SlotRequest = {
  /** ISO start requested by the host. */
  startIso: string;
  /** Room label as LibCal prints it, e.g. "Bass C10F". */
  roomLabel: string;
  /** LibCal space id, when the spot is reservable. */
  spaceId?: number;
  /** LibCal location id, used to query the live grid. */
  lid?: number;
  /** LibCal group id, used to query the live grid. */
  gid?: number;
  /** Base room page, used when there is no space id to build a link from. */
  bookingUrl?: string;
};

/** One 15-minute block from Yale's availability grid. */
export type LibcalGridSlot = {
  /** ISO start in UTC, derived from Yale's New Haven wall clock. */
  startIso: string;
  endIso?: string;
  /** False for red booked cells and padding; true for green. */
  available: boolean;
  /** Raw LibCal class, e.g. `s-lc-eq-checkout`. Empty means green. */
  className: string;
};

export type EarliestAvailable = {
  /** The start Autofill should click. */
  startIso: string;
  /** The start the user asked for, snapped to the grid. */
  requestedIso: string;
  /** True when the requested cell itself is green. */
  requestedAvailable: boolean;
  /** True when we moved off the requested start. */
  shifted: boolean;
  /** LibCal class on the requested cell, when the grid had one. */
  requestedClassName: string | null;
};

/** Red booked / padding classes on schedule.yale.edu. Never click these. */
export const LIBCAL_BLOCKED_CLASS =
  /s-lc-eq-checkout|s-lc-eq-period-booked|s-lc-eq-r-unavailable|s-lc-eq-r-padding|s-lc-eq-unavail/;

/**
 * Green bookable vs red booked, using LibCal's own class names.
 *
 * The grid JSON omits `className` (or sends "") for available slots, and
 * stamps booked cells with `s-lc-eq-checkout`.
 */
export function isLibcalSlotAvailable(className?: string | null): boolean {
  const value = className?.trim() ?? "";
  if (!value) return true;
  if (LIBCAL_BLOCKED_CLASS.test(value)) return false;
  return /s-lc-eq-avail/.test(value);
}

/** Round down to LibCal's grid so the start lines up with a block. */
export function snapToGrid(startIso: string): string {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return startIso;
  const stepMs = LIBCAL_GRID_MINUTES * 60 * 1000;
  return new Date(Math.floor(date.getTime() / stepMs) * stepMs).toISOString();
}

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

/** `2026-09-11` in New Haven's timezone, which is what LibCal's grid keys on. */
export function yaleDateKey(startIso: string): string {
  const p = parts(startIso);
  if (!p.year) return "";
  const monthIndex = new Date(`${p.month} 1, 2000`).getMonth() + 1;
  return `${p.year}-${String(monthIndex).padStart(2, "0")}-${p.day.padStart(2, "0")}`;
}

/** `1:00pm`, matching how LibCal renders a slot time. */
export function yaleTimeLabel(startIso: string): string {
  const p = parts(startIso);
  if (!p.hour) return "";
  return `${p.hour}:${p.minute}${(p.dayPeriod ?? "").toLowerCase()}`;
}

function hour24(p: Record<string, string>): number {
  let hour = Number(p.hour);
  const period = (p.dayPeriod ?? "").toLowerCase();
  if (period.startsWith("p") && hour !== 12) hour += 12;
  if (period.startsWith("a") && hour === 12) hour = 0;
  return hour;
}

/**
 * Parse LibCal's `YYYY-MM-DD HH:mm:ss` wall clock (America/New_York) to ISO.
 */
export function parseYaleWallTime(wall: string): string {
  const match = wall.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  for (const offsetHours of [4, 5]) {
    const iso = new Date(
      Date.UTC(year, month - 1, day, hour + offsetHours, minute, second),
    ).toISOString();
    const p = parts(iso);
    const monthIndex = new Date(`${p.month} 1, 2000`).getMonth() + 1;
    if (
      Number(p.year) === year &&
      monthIndex === month &&
      Number(p.day) === day &&
      hour24(p) === hour &&
      Number(p.minute) === minute
    ) {
      return iso;
    }
  }
  return "";
}

const SLOT_MATCH_MS = 60 * 1000;

/**
 * Prefer the requested start when it is green; otherwise the earliest green
 * cell at or after that time; otherwise the earliest green on the grid.
 */
export function pickEarliestAvailable(
  slots: LibcalGridSlot[],
  requestedIso: string,
): EarliestAvailable | null {
  const requested = snapToGrid(requestedIso);
  const requestedMs = Date.parse(requested);
  if (!Number.isFinite(requestedMs)) return null;

  const ranked = [...slots]
    .map((slot) => ({ slot, ms: Date.parse(slot.startIso) }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms);

  const requestedRow = ranked.find((row) => Math.abs(row.ms - requestedMs) < SLOT_MATCH_MS);
  const requestedAvailable = requestedRow ? requestedRow.slot.available : false;
  const requestedClassName = requestedRow?.slot.className || null;

  const open = ranked.filter((row) => row.slot.available);
  const exact = open.find((row) => Math.abs(row.ms - requestedMs) < SLOT_MATCH_MS);
  const chosen = exact ?? open.find((row) => row.ms >= requestedMs - SLOT_MATCH_MS) ?? open[0];
  if (!chosen) return null;

  return {
    startIso: snapToGrid(chosen.slot.startIso),
    requestedIso: requested,
    requestedAvailable,
    shifted: Math.abs(chosen.ms - requestedMs) >= SLOT_MATCH_MS,
    requestedClassName,
  };
}

/**
 * The confirmation LibCal shows once a green block turns yellow, e.g.
 * `Bass C10F: 1:00pm Friday, September 11, 2026 until...`
 *
 * Trailing `until...` stands in for the end time, which stays on LibCal's
 * default because the end-time dropdown is left alone.
 */
export function selectionMessage(request: SlotRequest): string {
  const p = parts(request.startIso);
  if (!p.hour) return request.roomLabel;
  const time = yaleTimeLabel(request.startIso);
  return `${request.roomLabel}: ${time} ${p.weekday}, ${p.month} ${p.day}, ${p.year} until...`;
}

/** The URL that opens the room's grid on the requested day. */
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
  spot: Pick<
    StudySpot,
    "name" | "bookingUrl" | "libcalSpaceId" | "libcalLabel" | "libcalLid" | "libcalGid"
  >,
  startIso: string,
): SlotRequest {
  return {
    startIso: snapToGrid(startIso),
    roomLabel: spot.libcalLabel ?? spot.name,
    spaceId: spot.libcalSpaceId,
    lid: spot.libcalLid,
    gid: spot.libcalGid,
    bookingUrl: spot.bookingUrl,
  };
}

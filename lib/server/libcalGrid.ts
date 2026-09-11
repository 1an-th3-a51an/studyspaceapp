import {
  isLibcalSlotAvailable,
  parseYaleWallTime,
  pickEarliestAvailable,
  snapToGrid,
  yaleDateKey,
  type EarliestAvailable,
  type LibcalGridSlot,
} from "@/lib/libcal";
import { findSpotByLibcalSpaceId, type StudySpot } from "@/lib/spots";

const YALE_ORIGIN = "https://schedule.yale.edu";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const LOOKAHEAD_DAYS = 3;
const FETCH_MS = 12_000;

type GridJson = {
  slots?: {
    start?: string;
    end?: string;
    itemId?: number;
    className?: string;
  }[];
};

export type LibcalAvailabilityResult = EarliestAvailable & {
  ok: true;
  spaceId: number;
  /** How many green vs blocked cells we saw for this room. */
  availableCount: number;
  bookedCount: number;
};

function cookieHeader(headers: Headers): string {
  const fromSet = headers.getSetCookie?.() ?? [];
  if (fromSet.length > 0) {
    return fromSet.map((cookie) => cookie.split(";")[0]?.trim() ?? "").filter(Boolean).join("; ");
  }
  const single = headers.get("set-cookie");
  return single ? single.split(";")[0]?.trim() ?? "" : "";
}

function parseIds(html: string): { lid?: number; gid?: number; eid?: number } {
  const lid = Number(html.match(/\blid:\s*(\d+)/)?.[1]);
  const gid = Number(html.match(/\bgid:\s*(\d+)/)?.[1]);
  const eid = Number(html.match(/\beid:\s*(\d+)/)?.[1]);
  return {
    lid: Number.isFinite(lid) && lid > 0 ? lid : undefined,
    gid: Number.isFinite(gid) && gid > 0 ? gid : undefined,
    eid: Number.isFinite(eid) && eid > 0 ? eid : undefined,
  };
}

function addDays(dateKey: string, days: number): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toSlots(raw: GridJson["slots"], spaceId: number): LibcalGridSlot[] {
  const slots: LibcalGridSlot[] = [];
  for (const row of raw ?? []) {
    if (Number(row.itemId) !== spaceId) continue;
    const startIso = row.start ? parseYaleWallTime(row.start) : "";
    if (!startIso) continue;
    const className = row.className?.trim() ?? "";
    slots.push({
      startIso,
      endIso: row.end ? parseYaleWallTime(row.end) || undefined : undefined,
      available: isLibcalSlotAvailable(className),
      className,
    });
  }
  return slots;
}

/**
 * Live availability for one Yale LibCal space, using the same grid the
 * booking page paints as green vs red.
 */
export async function fetchLibcalAvailability(input: {
  spaceId: number;
  startIso: string;
  lid?: number;
  gid?: number;
  spot?: StudySpot;
}): Promise<LibcalAvailabilityResult | { ok: false; error: string }> {
  const spaceId = input.spaceId;
  const requestedIso = snapToGrid(input.startIso);
  const date = yaleDateKey(requestedIso);
  if (!date) return { ok: false, error: "invalid start" };

  const spot = input.spot ?? findSpotByLibcalSpaceId(spaceId);
  const spaceUrl = `${YALE_ORIGIN}/space/${spaceId}?date=${date}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);

  try {
    const page = await fetch(spaceUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!page.ok) return { ok: false, error: `yale space ${page.status}` };

    const html = await page.text();
    const parsed = parseIds(html);
    const lid = input.lid ?? spot?.libcalLid ?? parsed.lid;
    const gid = input.gid ?? spot?.libcalGid ?? parsed.gid;
    if (!lid || !gid) return { ok: false, error: "missing lid/gid" };

    const cookie = cookieHeader(page.headers);
    const body = new URLSearchParams({
      lid: String(lid),
      gid: String(gid),
      eid: String(spaceId),
      seat: "0",
      zone: "0",
      start: date,
      end: addDays(date, LOOKAHEAD_DAYS),
      pageIndex: "0",
      pageSize: "18",
    });

    const grid = await fetch(`${YALE_ORIGIN}/spaces/availability/grid`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: spaceUrl,
        Origin: YALE_ORIGIN,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
      cache: "no-store",
    });
    if (!grid.ok) return { ok: false, error: `yale grid ${grid.status}` };

    const json = (await grid.json()) as GridJson;
    const slots = toSlots(json.slots, spaceId);
    const picked = pickEarliestAvailable(slots, requestedIso);
    if (!picked) return { ok: false, error: "no available slots" };

    return {
      ok: true,
      spaceId,
      ...picked,
      availableCount: slots.filter((s) => s.available).length,
      bookedCount: slots.filter((s) => !s.available).length,
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "yale fetch failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

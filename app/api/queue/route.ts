import {
  normalizeCourseCode,
  similarCourses,
} from "@/lib/courseSimilarity";
import type {
  QueueEntry,
  QueueSnapshot,
  RoomBooking,
  StudyPool,
} from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Live pooling queue + booking announcements.
 *
 * In-memory store, kept on globalThis so it survives dev HMR. It lives for as
 * long as one server process does, which is exactly what a hackathon demo on
 * one machine needs. Swap the `store()` functions for Firestore to go multi-
 * instance.
 */

type Store = {
  queue: QueueEntry[];
  bookings: RoomBooking[];
  pools: StudyPool[];
};

const g = globalThis as unknown as { __studyspaceQueue?: Store };
function store(): Store {
  g.__studyspaceQueue ??= { queue: [], bookings: [], pools: [] };
  return g.__studyspaceQueue;
}

const STALE_MS = 45_000; // no heartbeat for this long → dropped from the queue
const BOOKING_TTL_MS = 6 * 60 * 60 * 1000; // announcements expire 6h after start
const MAX_NAME = 40;

/**
 * How long a matched pool (and its queue entries) stays around before being
 * deleted. Set POOL_TTL_MINUTES in the environment; defaults to 15 minutes.
 */
function poolTtlMs(): number {
  const raw = Number(process.env.POOL_TTL_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 15;
  return minutes * 60 * 1000;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME) : "";
}

function gc(now: number) {
  const s = store();
  const poolTtl = poolTtlMs();
  s.pools = s.pools.filter((p) => now - Date.parse(p.createdAt) < poolTtl);
  const livePoolIds = new Set(s.pools.map((p) => p.id));
  s.queue = s.queue.filter((e) =>
    e.poolId
      ? livePoolIds.has(e.poolId)
      : now - Date.parse(e.lastSeenAt) < STALE_MS,
  );
  s.bookings = s.bookings.filter(
    (b) => now - Date.parse(b.start) < BOOKING_TTL_MS,
  );
}

/**
 * Matchmaker: a pool forms as soon as enough people are waiting in a course to
 * satisfy the smallest requested group size among them. First come, first
 * matched.
 */
function tryMatch(courseCode: string, now: number): StudyPool | null {
  const s = store();
  const waiting = s.queue
    .filter((e) => e.courseCode === courseCode && !e.poolId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  if (waiting.length < 2) return null;
  const size = Math.min(...waiting.map((e) => e.targetGroupSize));
  if (waiting.length < size) return null;

  const members = waiting.slice(0, size);
  const pool: StudyPool = {
    id: crypto.randomUUID(),
    courseCode,
    hostDisplayName: members[0].displayName,
    targetGroupSize: Math.min(4, Math.max(1, size)) as 1 | 2 | 3 | 4,
    memberCount: size,
    isDemoSample: false,
    createdAt: new Date(now).toISOString(),
  };
  s.pools.unshift(pool);
  for (const m of members) m.poolId = pool.id;
  return pool;
}

function snapshot(courseCode: string, deviceId: string, now: number): QueueSnapshot {
  const s = store();
  const similar = similarCourses(courseCode);
  const adjacent = new Map(similar.map((c) => [c.courseCode, c.label]));

  const queue = s.queue.filter((e) => e.courseCode === courseCode);
  const myEntry = queue.find((e) => e.deviceId === deviceId) ?? null;

  const bookings = s.bookings
    .filter((b) => b.courseCode === courseCode || adjacent.has(b.courseCode))
    .map((b) => ({
      ...b,
      via: b.courseCode === courseCode ? undefined : adjacent.get(b.courseCode),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  return {
    serverTime: new Date(now).toISOString(),
    courseCode,
    similarCourses: similar.map((c) => ({ courseCode: c.courseCode, label: c.label })),
    queue,
    myEntry,
    pools: s.pools.filter((p) => p.courseCode === courseCode),
    bookings,
  };
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const courseCode = normalizeCourseCode(url.searchParams.get("courseCode") ?? "");
  const deviceId = url.searchParams.get("deviceId") ?? "";
  if (!courseCode) return json({ error: "courseCode required" }, 400);

  const now = Date.now();
  gc(now);

  // Polling doubles as a heartbeat for whoever is asking.
  if (deviceId) {
    const mine = store().queue.find(
      (e) => e.deviceId === deviceId && e.courseCode === courseCode && !e.poolId,
    );
    if (mine) mine.lastSeenAt = new Date(now).toISOString();
  }

  return json(snapshot(courseCode, deviceId, now));
}

type Body = {
  action?: string;
  deviceId?: string;
  displayName?: string;
  courseCode?: string;
  targetGroupSize?: number;
  spotName?: string;
  bookingUrl?: string;
  start?: string;
  capacity?: number;
  bookingId?: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const now = Date.now();
  gc(now);
  const s = store();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId) return json({ error: "deviceId required" }, 400);

  switch (body.action) {
    case "join": {
      const courseCode = normalizeCourseCode(body.courseCode ?? "");
      const displayName = cleanName(body.displayName);
      const size = Number(body.targetGroupSize);
      if (!courseCode) return json({ error: "courseCode required" }, 400);
      if (!displayName) return json({ error: "displayName required" }, 400);
      if (!Number.isInteger(size) || size < 2 || size > 8) {
        return json({ error: "targetGroupSize must be 2-8" }, 400);
      }
      // One live entry per device per course; re-joining just refreshes it.
      s.queue = s.queue.filter(
        (e) => !(e.deviceId === deviceId && e.courseCode === courseCode && !e.poolId),
      );
      const nowIso = new Date(now).toISOString();
      s.queue.push({
        id: crypto.randomUUID(),
        deviceId,
        displayName,
        courseCode,
        targetGroupSize: size,
        joinedAt: nowIso,
        lastSeenAt: nowIso,
      });
      const pool = tryMatch(courseCode, now);
      return json({ ...snapshot(courseCode, deviceId, now), matched: pool });
    }

    case "leave": {
      const courseCode = normalizeCourseCode(body.courseCode ?? "");
      s.queue = s.queue.filter(
        (e) => !(e.deviceId === deviceId && e.courseCode === courseCode && !e.poolId),
      );
      return json(snapshot(courseCode, deviceId, now));
    }

    case "book": {
      const courseCode = normalizeCourseCode(body.courseCode ?? "");
      const hostDisplayName = cleanName(body.displayName);
      const spotName = cleanName(body.spotName);
      const startMs = Date.parse(body.start ?? "");
      const capacity = Number(body.capacity);
      if (!courseCode) return json({ error: "courseCode required" }, 400);
      if (!hostDisplayName) return json({ error: "displayName required" }, 400);
      if (!spotName) return json({ error: "spotName required" }, 400);
      if (Number.isNaN(startMs)) return json({ error: "start must be ISO 8601" }, 400);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
        return json({ error: "capacity must be 1-200" }, 400);
      }
      const booking: RoomBooking = {
        id: crypto.randomUUID(),
        deviceId,
        hostDisplayName,
        courseCode,
        spotName,
        bookingUrl:
          typeof body.bookingUrl === "string" && /^https?:\/\//.test(body.bookingUrl)
            ? body.bookingUrl
            : undefined,
        start: new Date(startMs).toISOString(),
        capacity,
        members: [{ deviceId, displayName: hostDisplayName }],
        createdAt: new Date(now).toISOString(),
      };
      s.bookings.unshift(booking);
      return json({ ...snapshot(courseCode, deviceId, now), booking });
    }

    case "joinBooking": {
      const displayName = cleanName(body.displayName);
      const booking = s.bookings.find((b) => b.id === body.bookingId);
      if (!booking) return json({ error: "booking not found" }, 404);
      if (!displayName) return json({ error: "displayName required" }, 400);
      if (!booking.members.some((m) => m.deviceId === deviceId)) {
        if (booking.members.length >= booking.capacity) {
          return json({ error: "booking full" }, 409);
        }
        booking.members.push({ deviceId, displayName });
      }
      const courseCode = normalizeCourseCode(body.courseCode ?? booking.courseCode);
      return json({ ...snapshot(courseCode, deviceId, now), booking });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
}

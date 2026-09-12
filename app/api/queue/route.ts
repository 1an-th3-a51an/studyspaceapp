import { normalizeCourseCode } from "@/lib/courseSimilarity";
import { resolveActor } from "@/lib/server/auth";
import {
  assertDisplayName,
  cleanName,
  getLiveStore,
  jsonError,
} from "@/lib/server/liveStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const courseCode = normalizeCourseCode(url.searchParams.get("courseCode") ?? "");
    const deviceId = (await resolveActor(request, url.searchParams.get("deviceId") ?? "")).deviceId;
    if (!courseCode) return json({ error: "courseCode required" }, 400);

    const store = getLiveStore();
    const now = Date.now();
    await store.gc(now);
    if (deviceId) await store.heartbeat(courseCode, deviceId, now);
    return json(await store.snapshot(courseCode, deviceId, now));
  } catch (error) {
    return jsonError(error);
  }
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
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    const rawDeviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!rawDeviceId) return json({ error: "deviceId required" }, 400);
    const actor = await resolveActor(request, rawDeviceId);
    const deviceId = actor.deviceId;

    const store = getLiveStore();
    const now = Date.now();
    await store.gc(now);

    switch (body.action) {
      case "join": {
        const courseCode = normalizeCourseCode(body.courseCode ?? "");
        const displayName = assertDisplayName(body.displayName ?? "");
        const size = Number(body.targetGroupSize);
        if (!courseCode) return json({ error: "courseCode required" }, 400);
        if (!Number.isInteger(size) || size < 2 || size > 8) {
          return json({ error: "targetGroupSize must be 2-8" }, 400);
        }
        return json(
          await store.joinQueue({
            deviceId,
            displayName,
            courseCode,
            targetGroupSize: size,
            now,
          }),
        );
      }
      case "leave": {
        const courseCode = normalizeCourseCode(body.courseCode ?? "");
        return json(await store.leaveQueue({ deviceId, courseCode, now }));
      }
      case "book": {
        const courseCode = normalizeCourseCode(body.courseCode ?? "");
        const hostDisplayName = assertDisplayName(body.displayName ?? "");
        const spotName = cleanName(body.spotName);
        const startMs = Date.parse(body.start ?? "");
        const capacity = Number(body.capacity);
        if (!courseCode) return json({ error: "courseCode required" }, 400);
        if (!spotName) return json({ error: "spotName required" }, 400);
        if (Number.isNaN(startMs)) return json({ error: "start must be ISO 8601" }, 400);
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
          return json({ error: "capacity must be 1-200" }, 400);
        }
        const bookingUrl =
          typeof body.bookingUrl === "string" && /^https?:\/\//.test(body.bookingUrl)
            ? body.bookingUrl
            : undefined;
        return json(
          await store.book({
            deviceId,
            displayName: hostDisplayName,
            courseCode,
            spotName,
            bookingUrl,
            start: new Date(startMs).toISOString(),
            capacity,
            now,
            hostEmail: actor.email,
          }),
        );
      }
      case "joinBooking": {
        const displayName = assertDisplayName(body.displayName ?? "");
        const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
        if (!bookingId) return json({ error: "bookingId required" }, 400);
        return json(
          await store.joinBooking({
            deviceId,
            displayName,
            bookingId,
            courseCode: body.courseCode ?? "",
            now,
          }),
        );
      }
      case "release": {
        const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
        if (!bookingId) return json({ error: "bookingId required" }, 400);
        return json(
          await store.releaseBooking({
            deviceId,
            bookingId,
            courseCode: body.courseCode ?? "",
            now,
          }),
        );
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (error) {
    return jsonError(error);
  }
}

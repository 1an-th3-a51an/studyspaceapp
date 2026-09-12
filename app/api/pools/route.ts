import { normalizeCourseCode } from "@/lib/courseSimilarity";
import { resolveActor } from "@/lib/server/auth";
import {
  assertDisplayName,
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
    if (!courseCode) return json({ error: "courseCode required" }, 400);
    const store = getLiveStore();
    const now = Date.now();
    await store.gc(now);
    const pools = await store.listPools(courseCode, now);
    return json({ pools, wired: store.backend.durable, backend: store.backend });
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
  poolId?: string;
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
    const deviceId = (await resolveActor(request, rawDeviceId)).deviceId;

    const store = getLiveStore();
    const now = Date.now();
    await store.gc(now);

    switch (body.action) {
      case "host": {
        const courseCode = normalizeCourseCode(body.courseCode ?? "");
        const hostDisplayName = assertDisplayName(body.displayName ?? "");
        const size = Number(body.targetGroupSize);
        if (!courseCode) return json({ error: "courseCode required" }, 400);
        if (!Number.isInteger(size) || size < 1 || size > 4) {
          return json({ error: "targetGroupSize must be 1-4" }, 400);
        }
        const pool = await store.hostPool({
          deviceId,
          courseCode,
          hostDisplayName,
          targetGroupSize: size as 1 | 2 | 3 | 4,
          now,
        });
        return json({ pool, wired: store.backend.durable, backend: store.backend });
      }
      case "join": {
        const poolId = typeof body.poolId === "string" ? body.poolId.trim() : "";
        if (!poolId) return json({ error: "poolId required" }, 400);
        if (body.displayName) assertDisplayName(body.displayName);
        const pool = await store.joinPool({ deviceId, poolId, now });
        return json({ pool, wired: store.backend.durable, backend: store.backend });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (error) {
    return jsonError(error);
  }
}

import { isCanonicalCourseCode, normalizeCourseCode } from "@/lib/courseSimilarity";
import {
  assertDisplayName,
  cleanName,
  getLiveStore,
  jsonError,
  normalizeNetId,
} from "@/lib/server/liveStore";
import { resolveActor } from "@/lib/server/auth";
import { findSpot } from "@/lib/spots";
import { PRIVATE_POOL_REASONS, type PrivatePoolReason } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NETID_RE = /^[a-z]{2,4}\d{1,5}$/i;
const YALE_EMAIL_RE = /^[a-z0-9._%+-]+@yale\.edu$/i;
const MAX_INVITEES = 8;
const MAX_NOTE = 200;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawDeviceId = url.searchParams.get("deviceId")?.trim() ?? "";
    const netId = normalizeNetId(url.searchParams.get("netId"));
    if (!rawDeviceId) return json({ error: "deviceId required" }, 400);
    const actor = await resolveActor(request, rawDeviceId);
    const store = getLiveStore();
    const now = Date.now();
    await store.gc(now);
    const pools = await store.listPrivatePools({ deviceId: actor.deviceId, netId, email: actor.email, now });
    return json({ serverTime: new Date(now).toISOString(), netId, signedInAs: actor.email ?? null, pools });
  } catch (error) {
    return jsonError(error);
  }
}

type Body = {
  action?: string;
  deviceId?: string;
  displayName?: string;
  netId?: string;
  inviteeNetIds?: unknown;
  reason?: string;
  note?: string;
  courseCode?: string;
  spotName?: string;
  start?: string;
  poolId?: string;
  accept?: boolean;
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
      case "create": {
        const displayName = assertDisplayName(body.displayName ?? "");
        const netId = normalizeNetId(body.netId) || actor.email || "";
        if (!(NETID_RE.test(netId) || YALE_EMAIL_RE.test(netId))) {
          return json({ error: "your NetID looks wrong (e.g. abc123), or sign in with Yale" }, 400);
        }
        const raw = Array.isArray(body.inviteeNetIds) ? body.inviteeNetIds : [];
        const invitees = Array.from(
          new Set(
            raw
              .map((v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
              .filter((n: string) => n && n !== netId && n !== actor.email),
          ),
        );
        if (invitees.length === 0) return json({ error: "invite at least one NetID or yale.edu email" }, 400);
        if (invitees.length > MAX_INVITEES) {
          return json({ error: `invite at most ${MAX_INVITEES} people` }, 400);
        }
        const bad = invitees.find((n) => !(NETID_RE.test(n) || YALE_EMAIL_RE.test(n)));
        if (bad) return json({ error: `"${bad}" is not a NetID or yale.edu email` }, 400);
        const reason = PRIVATE_POOL_REASONS.some((r) => r.value === body.reason)
          ? (body.reason as PrivatePoolReason)
          : "other";
        const note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";
        const courseRaw = body.courseCode ? normalizeCourseCode(body.courseCode) : "";
        const courseCode = courseRaw && isCanonicalCourseCode(courseRaw) ? courseRaw : undefined;
        const spotName = cleanName(body.spotName) || undefined;
        const spot = spotName ? findSpot(spotName) : undefined;
        const startMs = body.start ? Date.parse(body.start) : NaN;
        const start = Number.isNaN(startMs) ? undefined : new Date(startMs).toISOString();
        const pool = await store.createPrivatePool({
          deviceId,
          displayName,
          netId,
          inviteeNetIds: invitees,
          reason,
          note: note || undefined,
          courseCode,
          spotName,
          bookingUrl: spot?.bookingUrl,
          start,
          now,
        });
        return json({ pool });
      }
      case "respond": {
        const displayName = assertDisplayName(body.displayName ?? "");
        const netId = normalizeNetId(body.netId) || actor.email || "";
        const poolId = typeof body.poolId === "string" ? body.poolId : "";
        if (!netId) return json({ error: "netId required (or sign in with Yale)" }, 400);
        if (!poolId) return json({ error: "poolId required" }, 400);
        const pool = await store.respondPrivatePool({
          deviceId,
          displayName,
          netId,
          email: actor.email,
          poolId,
          accept: body.accept !== false,
          now,
        });
        return json({ pool });
      }
      case "cancel": {
        const poolId = typeof body.poolId === "string" ? body.poolId : "";
        if (!poolId) return json({ error: "poolId required" }, 400);
        return json(await store.cancelPrivatePool({ deviceId, poolId, now }));
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (error) {
    return jsonError(error);
  }
}

import { isCanonicalCourseCode, normalizeCourseCode } from "@/lib/courseSimilarity";
import { resolveActor } from "@/lib/server/auth";
import {
  assertEmail,
  cleanName,
  getLiveStore,
  jsonError,
} from "@/lib/server/liveStore";
import { isMailConfigured } from "@/lib/server/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A dumped multi-year Yale .ics can list many courses; relatedness is expanded at send time. */
const MAX_SUBSCRIBE_COURSES = 100;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

type Body = {
  action?: "subscribe" | "unsubscribe";
  deviceId?: string;
  email?: string;
  displayName?: string;
  courseCodes?: unknown;
};

/**
 * Record who can be emailed for a course.
 *
 * Clients send the user's own schedule codes only. When a room is booked, the
 * server expands similar catalog courses. Signed-in Yale accounts should sync
 * here automatically; the Connect form is an extra address or an opt-out.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    const store = getLiveStore();
    const rawDeviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const actor = await resolveActor(request, rawDeviceId);

    if (body.action === "unsubscribe") {
      const requested =
        typeof body.email === "string" && body.email.trim() ? assertEmail(body.email) : undefined;
      const addresses = Array.from(new Set([requested, actor.email].filter((v): v is string => Boolean(v))));
      if (addresses.length === 0) return json({ error: "email required" }, 400);
      let removed = 0;
      for (const email of addresses) {
        removed += (await store.unsubscribe({ email })).removed;
      }
      return json({ removed, email: requested ?? actor.email });
    }

    if (!rawDeviceId) return json({ error: "deviceId required" }, 400);
    const deviceId = actor.deviceId;

    const formEmail =
      typeof body.email === "string" && body.email.trim() ? assertEmail(body.email) : undefined;
    const email = formEmail ?? (actor.email ? assertEmail(actor.email) : undefined);
    if (!email) return json({ error: "email required" }, 400);

    const courseCodes = Array.isArray(body.courseCodes)
      ? Array.from(
          new Set(
            body.courseCodes
              .filter((c): c is string => typeof c === "string")
              .map((c) => normalizeCourseCode(c))
              .filter((c) => isCanonicalCourseCode(c)),
          ),
        ).slice(0, MAX_SUBSCRIBE_COURSES)
      : [];
    if (courseCodes.length === 0) {
      return json({ error: "at least one valid course code is required" }, 400);
    }

    const result = await store.subscribe({
      deviceId,
      email,
      displayName: cleanName(body.displayName) || actor.name,
      courseCodes,
      now: Date.now(),
    });

    // Signed-in Yale email is the classmate address even if they also left a
    // different extra address on the Connect form.
    if (actor.email && actor.email !== email) {
      await store.subscribe({
        deviceId,
        email: actor.email,
        displayName: cleanName(body.displayName) || actor.name,
        courseCodes,
        now: Date.now(),
      });
    }

    return json({
      ...result,
      email,
      mailConfigured: isMailConfigured(),
      backend: store.backend,
    });
  } catch (error) {
    return jsonError(error);
  }
}

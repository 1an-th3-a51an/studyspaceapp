import { isCanonicalCourseCode, normalizeCourseCode } from "@/lib/courseSimilarity";
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
 * Opt an address in to booking announcements for the courses on a schedule.
 *
 * Subscriptions are per-course so a booking can reach the host's class plus
 * adjacent classes without the app ever holding a Yale roster.
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
    const email = assertEmail(body.email);

    if (body.action === "unsubscribe") {
      return json({ ...(await store.unsubscribe({ email })), email });
    }

    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!deviceId) return json({ error: "deviceId required" }, 400);

    const courseCodes = Array.isArray(body.courseCodes)
      ? Array.from(
          new Set(
            body.courseCodes
              .filter((c): c is string => typeof c === "string")
              .map((c) => normalizeCourseCode(c))
              .filter((c) => isCanonicalCourseCode(c)),
          ),
        )
      : [];
    if (courseCodes.length === 0) {
      return json({ error: "at least one valid course code is required" }, 400);
    }
    if (courseCodes.length > 20) {
      return json({ error: "too many course codes" }, 400);
    }

    const result = await store.subscribe({
      deviceId,
      email,
      displayName: cleanName(body.displayName) || undefined,
      courseCodes,
      now: Date.now(),
    });

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

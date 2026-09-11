import { snapToGrid } from "@/lib/libcal";
import { fetchLibcalAvailability } from "@/lib/server/libcalGrid";
import { findSpot, findSpotByLibcalSpaceId } from "@/lib/spots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function numberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function spaceIdFromUrl(url: string | null): number | undefined {
  if (!url) return undefined;
  try {
    const match = new URL(url).pathname.match(/\/space\/(\d+)/);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Live green vs red slots for a Yale LibCal room, plus the earliest open
 * start Autofill should click.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const start = params.get("start");
  if (!start || Number.isNaN(Date.parse(start))) {
    return Response.json({ ok: false, error: "start required" }, { status: 400 });
  }

  const spotName = params.get("spot");
  const named = spotName ? findSpot(spotName) : undefined;
  const spaceId =
    numberParam(params.get("space")) ??
    named?.libcalSpaceId ??
    spaceIdFromUrl(params.get("url"));
  if (!spaceId) {
    return Response.json({ ok: false, error: "space required" }, { status: 400 });
  }

  const spot = named ?? findSpotByLibcalSpaceId(spaceId);
  const result = await fetchLibcalAvailability({
    spaceId,
    startIso: snapToGrid(start),
    lid: numberParam(params.get("lid")) ?? spot?.libcalLid,
    gid: numberParam(params.get("gid")) ?? spot?.libcalGid,
    spot,
  });

  return Response.json(result, { status: result.ok ? 200 : 502 });
}

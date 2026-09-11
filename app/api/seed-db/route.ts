import { getLiveStore, jsonError } from "@/lib/server/liveStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  try {
    const store = getLiveStore();
    const result = await store.seedDemoPools(Date.now());
    return Response.json({
      ok: true,
      ...result,
      backendInfo: store.backend,
      message: result.written
        ? `Seeded ${result.written} demo pool(s) into the ${store.backend.label} backend.`
        : `Demo pools were already present in the ${store.backend.label} backend.`,
    });
  } catch (error) {
    return jsonError(error);
  }
}

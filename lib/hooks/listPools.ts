import { apiFetch } from "@/lib/hooks/apiFetch";
import { ensureDeviceId } from "@/lib/identity";
import type { BackendInfo, StudyPool } from "@/lib/types";

async function readError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    /* fall through */
  }
  return `Pools API failed (${res.status})`;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await apiFetch("/api/pools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: ensureDeviceId(), ...body }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

export async function listPoolsByCourseCode(courseCode: string): Promise<{
  pools: StudyPool[];
  backend: BackendInfo | null;
}> {
  const params = new URLSearchParams({ courseCode });
  const res = await apiFetch(`/api/pools?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  const payload = (await res.json()) as { pools?: StudyPool[]; backend?: BackendInfo };
  return {
    pools: payload.pools ?? [],
    backend: payload.backend ?? null,
  };
}

export async function hostPool(input: {
  courseCode: string;
  hostDisplayName: string;
  targetGroupSize: 1 | 2 | 3 | 4;
}): Promise<{ pool: StudyPool; backend: BackendInfo | null }> {
  const payload = await post<{ pool: StudyPool; backend?: BackendInfo }>({
    action: "host",
    ...input,
  });
  return { pool: payload.pool, backend: payload.backend ?? null };
}

export async function joinPool(input: {
  poolId: string;
}): Promise<{ pool: StudyPool; backend: BackendInfo | null }> {
  const payload = await post<{ pool: StudyPool; backend?: BackendInfo }>({
    action: "join",
    poolId: input.poolId,
  });
  return { pool: payload.pool, backend: payload.backend ?? null };
}

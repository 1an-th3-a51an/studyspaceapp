"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/hooks/apiFetch";
import { ensureDeviceId } from "@/lib/identity";
import type { PrivatePool, PrivatePoolReason } from "@/lib/types";

async function readError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    /* fall through */
  }
  return `Private pool API failed (${res.status})`;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await apiFetch("/api/private-pools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: ensureDeviceId(), ...body }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

export function createPrivatePool(input: {
  displayName: string;
  netId: string;
  inviteeNetIds: string[];
  reason: PrivatePoolReason;
  note?: string;
  courseCode?: string;
  spotName?: string;
  start?: string;
}) {
  return post<{ pool: PrivatePool }>({ action: "create", ...input });
}

export function respondPrivatePool(input: {
  poolId: string;
  netId: string;
  displayName: string;
  accept: boolean;
}) {
  return post<{ pool: PrivatePool }>({ action: "respond", ...input });
}

export function cancelPrivatePool(poolId: string) {
  return post<{ removed: boolean }>({ action: "cancel", poolId });
}

/** Poll invite-only pools for this device and NetID. */
export function usePrivatePools(netId: string, intervalMs = 5000) {
  const [pools, setPools] = useState<PrivatePool[]>([]);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mySeq = ++seq.current;
    try {
      const params = new URLSearchParams({ deviceId: ensureDeviceId(), netId });
      const res = await apiFetch(`/api/private-pools?${params.toString()}`, { cache: "no-store" });
      if (mySeq !== seq.current) return;
      if (res.status === 404) {
        setAvailable(false);
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const payload = (await res.json()) as { pools: PrivatePool[] };
      if (mySeq !== seq.current) return;
      setPools(payload.pools);
      setAvailable(true);
      setError("");
      setLoaded(true);
    } catch (caught) {
      if (mySeq !== seq.current) return;
      setError(caught instanceof Error ? caught.message : "Could not load private pools");
    }
  }, [netId]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      await refresh();
      if (!stopped) timer = window.setTimeout(tick, document.hidden ? intervalMs * 4 : intervalMs);
    };
    timer = window.setTimeout(tick, 0);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs]);

  return { pools, error, available, loaded, refresh, setPools };
}

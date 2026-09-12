"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/hooks/apiFetch";
import { ensureDeviceId } from "@/lib/identity";
import type { QueueSnapshot, RoomBooking, StudyPool } from "@/lib/types";

async function readError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    /* fall through */
  }
  return `Queue API failed (${res.status})`;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await apiFetch("/api/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: ensureDeviceId(), ...body }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

export function joinQueue(input: {
  courseCode: string;
  displayName: string;
  targetGroupSize: number;
}) {
  return post<QueueSnapshot & { matched: StudyPool | null }>({ action: "join", ...input });
}

export function leaveQueue(courseCode: string) {
  return post<QueueSnapshot>({ action: "leave", courseCode });
}

export function announceBooking(input: {
  courseCode: string;
  displayName: string;
  spotName: string;
  bookingUrl?: string;
  start: string;
  capacity: number;
}) {
  return post<QueueSnapshot & { booking: RoomBooking }>({ action: "book", ...input });
}

export function releaseBooking(input: { bookingId: string; courseCode: string }) {
  return post<QueueSnapshot & { released: boolean }>({ action: "release", ...input });
}

export function joinBooking(input: {
  bookingId: string;
  displayName: string;
  courseCode: string;
}) {
  return post<QueueSnapshot & { booking: RoomBooking }>({ action: "joinBooking", ...input });
}

/**
 * Poll the queue for a course. Each poll is also this device's heartbeat, so
 * closing the tab drops you out of the queue within ~45s. Polling slows to
 * `hiddenIntervalMs` while the tab is hidden and snaps back on focus.
 */
export function useQueuePolling(
  courseCode: string,
  intervalMs = 3000,
  hiddenIntervalMs = 15_000,
) {
  const [raw, setRaw] = useState<QueueSnapshot | null>(null);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(true);
  // Only the newest request may write state; a slow response for a course
  // the user already navigated away from is dropped.
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const code = courseCode.trim();
    if (!code) return;
    const seq = ++requestSeq.current;
    try {
      const params = new URLSearchParams({ courseCode: code, deviceId: ensureDeviceId() });
      const res = await apiFetch(`/api/queue?${params.toString()}`, { cache: "no-store" });
      if (seq !== requestSeq.current) return;
      if (res.status === 404) {
        setAvailable(false);
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const next = (await res.json()) as QueueSnapshot;
      if (seq !== requestSeq.current) return;
      setRaw(next);
      setAvailable(true);
      setError("");
    } catch (caught) {
      if (seq !== requestSeq.current) return;
      setError(caught instanceof Error ? caught.message : "Queue poll failed");
    }
  }, [courseCode]);

  // Never show another course's snapshot, even for one render.
  const snapshot = raw && raw.courseCode === courseCode.trim() ? raw : null;
  const setSnapshot = useCallback((next: QueueSnapshot) => {
    requestSeq.current++; // a write from an action beats any poll in flight
    setRaw(next);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (stopped) return;
      await refresh();
      schedule(document.hidden ? hiddenIntervalMs : intervalMs);
    };
    const onVisibility = () => {
      // Coming back to the tab: refresh right away and resume the fast cadence.
      if (!document.hidden) schedule(0);
    };

    schedule(0);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, intervalMs, hiddenIntervalMs]);

  return { snapshot, error, available, refresh, setSnapshot };
}

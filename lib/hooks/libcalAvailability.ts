"use client";

import { useEffect, useState } from "react";
import { snapToGrid, type EarliestAvailable, type SlotRequest } from "@/lib/libcal";

export type LibcalAvailabilityState = EarliestAvailable & {
  availableCount?: number;
  bookedCount?: number;
};

async function readAvailability(request: SlotRequest): Promise<LibcalAvailabilityState | null> {
  if (!request.spaceId && !request.bookingUrl) return null;
  const params = new URLSearchParams({ start: snapToGrid(request.startIso) });
  if (request.spaceId) params.set("space", String(request.spaceId));
  if (request.lid) params.set("lid", String(request.lid));
  if (request.gid) params.set("gid", String(request.gid));
  if (request.bookingUrl) params.set("url", request.bookingUrl);
  const res = await fetch(`/api/libcal/availability?${params.toString()}`, { cache: "no-store" });
  const payload = (await res.json()) as Partial<LibcalAvailabilityState> & { ok?: boolean };
  if (!payload.ok || !payload.startIso) return null;
  return {
    startIso: payload.startIso,
    requestedIso: payload.requestedIso ?? snapToGrid(request.startIso),
    requestedAvailable: Boolean(payload.requestedAvailable),
    shifted: Boolean(payload.shifted),
    requestedClassName: payload.requestedClassName ?? null,
    availableCount: payload.availableCount,
    bookedCount: payload.bookedCount,
  };
}

/**
 * Asks Yale which grid cells are green vs red, then returns the earliest
 * bookable start at or after the requested time.
 */
export function useLibcalAvailability(request: SlotRequest | null): {
  availability: LibcalAvailabilityState | null;
  checking: boolean;
} {
  const [availability, setAvailability] = useState<LibcalAvailabilityState | null>(null);
  const [checking, setChecking] = useState(false);
  const spaceId = request?.spaceId;
  const startIso = request?.startIso;
  const lid = request?.lid;
  const gid = request?.gid;
  const bookingUrl = request?.bookingUrl;

  useEffect(() => {
    if (!startIso || (!spaceId && !bookingUrl)) {
      setAvailability(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    readAvailability({
      startIso,
      roomLabel: request?.roomLabel ?? "",
      spaceId,
      lid,
      gid,
      bookingUrl,
    })
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId, startIso, lid, gid, bookingUrl, request?.roomLabel]);

  return { availability, checking };
}

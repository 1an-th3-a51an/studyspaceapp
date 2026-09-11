"use client";

import { CalendarCheck, CalendarX2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLibcalAvailability } from "@/lib/hooks/libcalAvailability";
import { slotDeepLink, slotRequestForSpot, yaleTimeLabel } from "@/lib/libcal";
import { findSpot } from "@/lib/spots";

/**
 * Live availability from schedule.yale.edu for rooms with a LibCal space id.
 * Reads Yale's booking grid (green vs red cells) for the requested start and
 * reports the earliest open slot. Renders nothing for spots without an id.
 */
export function LiveAvailability({
  spotName,
  startIso,
}: {
  spotName: string;
  startIso?: string;
}) {
  const spot = findSpot(spotName);
  const request =
    spot?.libcalSpaceId && startIso ? slotRequestForSpot(spot, startIso) : null;
  const { availability, checking } = useLibcalAvailability(request);

  if (!request) return null;

  if (checking) {
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <Loader2 className="size-3 animate-spin" />
        Checking Yale…
      </Badge>
    );
  }
  if (!availability) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Live availability unavailable
      </Badge>
    );
  }

  const href = slotDeepLink({ ...request, startIso: availability.startIso }) ?? spot?.bookingUrl;
  const open = availability.requestedAvailable;
  const label = open
    ? `Open at ${yaleTimeLabel(availability.requestedIso)}`
    : availability.shifted
      ? `Booked at ${yaleTimeLabel(availability.requestedIso)} · next open ${yaleTimeLabel(availability.startIso)}`
      : `Booked at ${yaleTimeLabel(availability.requestedIso)}`;

  const badge = (
    <Badge
      variant={open ? "default" : "secondary"}
      className={`gap-1 font-normal ${open ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
      title="Live from schedule.yale.edu"
    >
      {open ? <CalendarCheck className="size-3" /> : <CalendarX2 className="size-3" />}
      {label}
      <span className="text-[0.65rem] uppercase tracking-wide opacity-80">live</span>
    </Badge>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {badge}
    </a>
  ) : (
    badge
  );
}

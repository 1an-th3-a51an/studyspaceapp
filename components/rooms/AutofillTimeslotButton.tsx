"use client";

import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autofillHelperPath, slotRequestForSpot } from "@/lib/libcal";
import { findSpot } from "@/lib/spots";

/**
 * Opens the Autofill helper, which opens Yale's Space Availability page and
 * hosts the bookmarklet that skips red booked cells and clicks the earliest
 * remaining green start.
 */
export function AutofillTimeslotButton({
  spotName,
  startIso,
  variant = "outline",
}: {
  spotName: string;
  startIso?: string;
  variant?: "outline" | "default" | "secondary";
}) {
  const spot = findSpot(spotName);
  if (!spot?.bookingUrl || !startIso) return null;
  const request = slotRequestForSpot(spot, startIso);
  const href = autofillHelperPath(request);

  return (
    <Button size="sm" variant={variant} asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <CalendarCheck className="size-3.5" />
        Autofill earliest open slot
      </a>
    </Button>
  );
}

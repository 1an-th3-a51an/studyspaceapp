"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, CalendarClock, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { formatWhen } from "@/lib/format";
import { joinBooking } from "@/lib/hooks/queue";
import { ensureDeviceId, getDisplayName } from "@/lib/identity";
import type { QueueSnapshot } from "@/lib/types";

export function OpenBookings({
  courseCode,
  snapshot,
  onSnapshot,
  onNeedName,
}: {
  courseCode: string;
  snapshot: QueueSnapshot | null;
  onSnapshot: (next: QueueSnapshot) => void;
  /** Called when a join is attempted with no saved display name. */
  onNeedName: () => void;
}) {
  const bookings = snapshot?.bookings ?? [];
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const deviceId = typeof window === "undefined" ? "" : ensureDeviceId();

  // Flag bookings that appeared since the last poll so the "notification"
  // is visible without a push channel.
  useEffect(() => {
    if (!snapshot) return;
    const ids = snapshot.bookings.map((b) => b.id);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    for (const id of ids) seen.current.add(id);
    if (added.length === 0) return;
    const timer = window.setTimeout(() => setFresh(new Set(added)), 0);
    const clear = window.setTimeout(() => setFresh(new Set()), 15_000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
    };
  }, [snapshot]);

  if (bookings.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-heading text-lg font-semibold">
          <BellRing className="size-4" />
          Booked rooms you can join
        </h2>
        <span className="text-xs text-muted-foreground">
          Announced to {courseCode} and adjacent courses
        </span>
      </div>
      <ul className="space-y-2">
        {bookings.map((b) => {
          const joined = b.members.some((m) => m.deviceId === deviceId);
          const full = b.members.length >= b.capacity;
          return (
            <li
              key={b.id}
              className={
                "space-y-2 rounded-lg border p-3 text-sm " +
                (fresh.has(b.id) ? "border-primary/50 bg-primary/5" : "")
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {b.hostDisplayName} booked {b.spotName}
                </span>
                <Badge variant="secondary">{b.courseCode}</Badge>
                {b.via ? <Badge variant="outline">{b.via}</Badge> : null}
                {fresh.has(b.id) ? <Badge>New</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3" />
                  {formatWhen(b.start)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {b.members.length}/{b.capacity} going ·{" "}
                  {b.members.map((m) => m.displayName).join(", ")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {joined ? (
                  <Badge variant="default">You&apos;re in</Badge>
                ) : (
                  <DebouncedSubmitButton
                    size="sm"
                    disabled={full}
                    onSubmit={async () => {
                      const displayName = getDisplayName();
                      if (!displayName) {
                        onNeedName();
                        return;
                      }
                      setError("");
                      try {
                        onSnapshot(
                          await joinBooking({ bookingId: b.id, displayName, courseCode }),
                        );
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Join failed");
                      }
                    }}
                  >
                    {full ? "Full" : "I'm coming"}
                  </DebouncedSubmitButton>
                )}
                {b.bookingUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={b.bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" />
                      Room page
                    </a>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

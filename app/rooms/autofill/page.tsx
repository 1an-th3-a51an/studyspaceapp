"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibcalAvailability } from "@/lib/hooks/libcalAvailability";
import {
  libcalBookmarklet,
  selectionMessage,
  slotDeepLink,
  type SlotRequest,
} from "@/lib/libcal";

/**
 * Companion page for Autofill.
 *
 * Yale's Space Availability site sets X-Frame-Options: deny, so this app cannot
 * click the green grid from our origin. This page opens the dated room page
 * and hosts a bookmarklet that, when run on that tab, skips red booked cells
 * and clicks the earliest green start (turns it yellow). It leaves the
 * end-time dropdown alone.
 */
function AutofillInner() {
  const params = useSearchParams();
  const request = useMemo<SlotRequest | null>(() => {
    const start = params.get("start");
    const label = params.get("label");
    if (!start || !label) return null;
    const space = params.get("space");
    const lid = params.get("lid");
    const gid = params.get("gid");
    return {
      startIso: start,
      roomLabel: label,
      spaceId: space ? Number(space) : undefined,
      lid: lid ? Number(lid) : undefined,
      gid: gid ? Number(gid) : undefined,
      bookingUrl: params.get("url") ?? undefined,
    };
  }, [params]);

  const { availability, checking } = useLibcalAvailability(request);
  const resolved = useMemo<SlotRequest | null>(() => {
    if (!request) return null;
    if (!availability?.startIso) return request;
    return { ...request, startIso: availability.startIso };
  }, [request, availability]);

  const yaleUrl = resolved ? slotDeepLink(resolved) : undefined;
  const message = resolved ? selectionMessage(resolved) : "";
  const bookmarklet = resolved ? libcalBookmarklet(resolved) : "";
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (linkRef.current && bookmarklet) {
      linkRef.current.setAttribute("href", bookmarklet);
    }
  }, [bookmarklet]);

  useEffect(() => {
    if (!yaleUrl || opened) return;
    const popup = window.open(yaleUrl, "yale-libcal");
    setOpened(true);
    if (!popup) return;
  }, [yaleUrl, opened]);

  if (!request || !yaleUrl) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <h1 className="font-heading text-2xl font-semibold">Autofill timeslot</h1>
        <p className="text-sm text-muted-foreground">
          Missing room or start time. Go back to Rooms and press Autofill on a
          bookable spot.
        </p>
        <Button asChild>
          <Link href="/rooms">Back to rooms</Link>
        </Button>
      </div>
    );
  }

  const shifted = Boolean(availability?.shifted);
  const requestedLabel = selectionMessage(request);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Autofill timeslot
        </h1>
        <p className="text-sm text-muted-foreground">
          Yale&apos;s booking page is open in another tab. On that tab, the
          bookmarklet skips red (already booked) cells and clicks the earliest
          green start so it turns yellow. Do not change the end-time dropdown —
          Yale keeps its default length.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {checking
            ? "Checking Yale for open slots"
            : shifted
              ? "Earliest open slot"
              : "LibCal will show"}
        </p>
        <p className="font-mono text-sm">{checking ? "…" : message}</p>
        {shifted ? (
          <p className="text-xs text-muted-foreground">
            {requestedLabel} is already booked (red). Autofill moved to the
            earliest green cell at or after that time.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={yaleUrl} target="yale-libcal" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
            Open Yale Space Availability
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a
            ref={linkRef}
            href="#"
            title="Drag this to your bookmarks bar, then click it on the Yale tab"
          >
            <CalendarCheck className="size-3.5" />
            Select earliest open start on Yale
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag &quot;Select earliest open start on Yale&quot; to your bookmarks
        bar, switch to the Yale tab, then click the bookmark. It never clicks a
        red cell. A Tampermonkey userscript at{" "}
        <a className="underline underline-offset-4" href="/libcal-autofill.user.js">
          /libcal-autofill.user.js
        </a>{" "}
        does the same automatically whenever the Yale URL has our hash.
      </p>
    </div>
  );
}

export default function AutofillPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
          Preparing Autofill…
        </div>
      }
    >
      <AutofillInner />
    </Suspense>
  );
}

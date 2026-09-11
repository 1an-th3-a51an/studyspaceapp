"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isCanonicalCourseCode, normalizeCourseCode, similarCourses } from "@/lib/courseSimilarity";
import { DEFAULT_COURSE_CODE } from "@/lib/demo/handsomeDan";
import { announceBooking } from "@/lib/hooks/queue";
import {
  getDisplayName,
  getNotifyEmail,
  setDisplayName as persistDisplayName,
  setNotifyEmail,
} from "@/lib/identity";
import { announceJoin } from "@/lib/joinBanner";
import { slotDeepLink, slotRequestForSpot, snapToGrid } from "@/lib/libcal";
import { failsProfanityCheck } from "@/lib/profanity";
import { subscribeToCourses } from "@/lib/hooks/subscribe";
import { findSpot, resolveBookingCapacity, UNKNOWN_SPOT_MAX_CAPACITY } from "@/lib/spots";
import type { MyCourse, StudyRecommendation } from "@/lib/types";

function nextHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookAndAnnounceDialog({
  spot,
  courses,
  defaultCourseCode,
  onOpenChange,
}: {
  /** The spot being booked; null closes the dialog. */
  spot: StudyRecommendation | null;
  /** Courses from the user's schedule, for the picker. */
  courses: MyCourse[];
  /** Pre-selected course, normally the one the search was anchored on. */
  defaultCourseCode?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [customCourse, setCustomCourse] = useState("");
  const [start, setStart] = useState(nextHourLocal);
  const [seats, setSeats] = useState("1");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const registrySpot = spot ? findSpot(spot.name) : undefined;
  const published =
    registrySpot?.capacitySource === "schedule.yale.edu" &&
    typeof registrySpot.capacity === "number"
      ? registrySpot.capacity
      : undefined;
  const maxSeats =
    published !== undefined
      ? Math.min(published, UNKNOWN_SPOT_MAX_CAPACITY)
      : UNKNOWN_SPOT_MAX_CAPACITY;

  useEffect(() => {
    if (!spot) return;
    const timer = window.setTimeout(() => {
      setName((n) => n || getDisplayName());
      setEmail((e) => e || getNotifyEmail());
      setCourse(defaultCourseCode || courses[0]?.courseCode || "custom");
      setStart(nextHourLocal());
      setSeats(String(Math.min(2, maxSeats)));
      setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [spot, courses, defaultCourseCode, maxSeats]);

  const resolvedCourse = normalizeCourseCode(course === "custom" ? customCourse : course);
  const similar = resolvedCourse ? similarCourses(resolvedCourse, 4) : [];
  const isRoom = spot?.kind === "room";

  const seatOptions = useMemo(
    () => Array.from({ length: Math.max(1, maxSeats) }, (_, i) => i + 1),
    [maxSeats],
  );

  const startIso = useMemo(() => {
    const ms = Date.parse(start);
    return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
  }, [start]);

  const yaleUrl = useMemo(() => {
    if (!registrySpot || !registrySpot.bookingUrl || !startIso) return spot?.bookingUrl;
    return slotDeepLink(slotRequestForSpot(registrySpot, startIso)) ?? spot?.bookingUrl;
  }, [registrySpot, startIso, spot?.bookingUrl]);

  async function submit() {
    if (!spot) return;
    if (!name.trim()) return setError("Display name is required.");
    if (failsProfanityCheck(name)) return setError("Display name failed the 5-word check.");
    if (!resolvedCourse || !isCanonicalCourseCode(resolvedCourse)) {
      return setError(`Enter a course code like ${DEFAULT_COURSE_CODE}.`);
    }
    if (!startIso) return setError("Pick a start time.");
    setError("");
    persistDisplayName(name.trim());

    if (yaleUrl) window.open(yaleUrl, "_blank", "noopener,noreferrer");

    try {
      if (email.trim()) {
        setNotifyEmail(email.trim());
        const codes = Array.from(
          new Set([
            resolvedCourse,
            ...courses.map((c) => c.courseCode),
            ...similar.map((a) => a.courseCode),
          ]),
        ).filter((c) => isCanonicalCourseCode(c));
        await subscribeToCourses({
          email: email.trim(),
          displayName: name.trim(),
          courseCodes: codes,
        }).catch(() => undefined);
      }

      const result = await announceBooking({
        courseCode: resolvedCourse,
        displayName: name.trim(),
        spotName: spot.name,
        bookingUrl: yaleUrl ?? spot.bookingUrl,
        start: snapToGrid(startIso),
        capacity: Number(seats),
      });

      const booking = result.booking;
      const notified = booking.notified;
      announceJoin({
        title: `You booked ${booking.spotName}`,
        detail:
          notified && notified.recipients > 0
            ? `${booking.courseCode} · ${booking.capacity} seat${booking.capacity === 1 ? "" : "s"} · emailed ${notified.recipients} classmate${notified.recipients === 1 ? "" : "s"}`
            : `${booking.courseCode} · ${booking.capacity} seat${booking.capacity === 1 ? "" : "s"}`,
      });

      onOpenChange(false);
      router.push(`/pools?course=${encodeURIComponent(resolvedCourse)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not announce booking");
    }
  }

  const ruling = spot ? resolveBookingCapacity(spot.name, Number(seats)) : null;

  return (
    <Dialog open={spot !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRoom ? "Book" : "Meet at"} {spot?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            {isRoom
              ? "Opens the Yale library page for this room on the date you pick. Yale shows live availability there. Then your class hears you have a room."
              : "Tells your class you will be here. No booking needed."}{" "}
            Classmates in {resolvedCourse || "your course"}
            {similar.length > 0
              ? ` and courses with similar catalog descriptions (${similar.map((a) => a.courseCode).join(", ")})`
              : ""}{" "}
            see it on the Pools page, and subscribers get an email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="book-name">Display name</Label>
            <Input
              id="book-name"
              placeholder="Eli '27"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-course">Course</Label>
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger id="book-course" className="w-full">
                <SelectValue placeholder="Pick a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.courseCode} value={c.courseCode}>
                    {c.title && c.title !== c.courseCode
                      ? `${c.courseCode} · ${c.title}`
                      : c.courseCode}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Other…</SelectItem>
              </SelectContent>
            </Select>
            {course === "custom" ? (
              <Input
                placeholder={DEFAULT_COURSE_CODE}
                value={customCourse}
                onChange={(e) => setCustomCourse(e.target.value.toUpperCase())}
              />
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="book-start">Start</Label>
              <Input
                id="book-start"
                type="datetime-local"
                step={1800}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-cap">Seats in this pool</Label>
              <Select value={seats} onValueChange={setSeats}>
                <SelectTrigger id="book-cap" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seatOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {published !== undefined
                  ? `schedule.yale.edu lists ${published} seat${published === 1 ? "" : "s"}${
                      published > UNKNOWN_SPOT_MAX_CAPACITY
                        ? `; the pool stays at most ${UNKNOWN_SPOT_MAX_CAPACITY}.`
                        : "; the pool cannot exceed that."
                    }`
                  : "Yale does not publish a seat count. This is how many classmates you are inviting, not a claimed room size."}
              </p>
            </div>
          </div>

          {yaleUrl ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                StudySpace sends you to this room&apos;s Yale page
                {startIso ? " with the date filled in" : ""}. It does not click a
                timeslot and does not claim a green cell is free.
              </p>
              <Button size="sm" variant="outline" asChild>
                <a href={yaleUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open Yale page
                </a>
              </Button>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="book-email">Email for announcements (optional)</Label>
            <Input
              id="book-email"
              type="email"
              inputMode="email"
              placeholder="you@yale.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Subscribes you to bookings for your courses, and is how classmates
              who subscribed hear about this one. No address, no email.
            </p>
          </div>

          {ruling?.note ? (
            <p className="text-sm text-muted-foreground">{ruling.note}</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <DebouncedSubmitButton onSubmit={submit}>
            {isRoom ? "Open Yale page & announce" : "Announce"}
          </DebouncedSubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

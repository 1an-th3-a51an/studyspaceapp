"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { AutofillTimeslotButton } from "@/components/rooms/AutofillTimeslotButton";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Badge } from "@/components/ui/badge";
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
import { useLibcalAvailability } from "@/lib/hooks/libcalAvailability";
import { autofillHelperPath, selectionMessage, slotDeepLink, slotRequestForSpot, snapToGrid } from "@/lib/libcal";
import { failsProfanityCheck } from "@/lib/profanity";
import { subscribeToCourses } from "@/lib/hooks/subscribe";
import { findSpot, resolveBookingCapacity } from "@/lib/spots";
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
  const published = registrySpot?.capacitySource === "schedule.yale.edu";
  const roomCapacity = registrySpot?.capacity ?? spot?.capacity ?? 4;

  useEffect(() => {
    if (!spot) return;
    const timer = window.setTimeout(() => {
      setName((n) => n || getDisplayName());
      setEmail((e) => e || getNotifyEmail());
      setCourse(defaultCourseCode || courses[0]?.courseCode || "custom");
      setStart(nextHourLocal());
      setSeats(String(roomCapacity));
      setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [spot, courses, defaultCourseCode, roomCapacity]);

  const resolvedCourse = normalizeCourseCode(course === "custom" ? customCourse : course);
  const adjacent = resolvedCourse ? similarCourses(resolvedCourse, 4) : [];
  const isRoom = spot?.kind === "room";

  // Seat options never exceed the room. A one-person room offers only "1".
  const seatOptions = useMemo(
    () => Array.from({ length: Math.max(1, roomCapacity) }, (_, i) => i + 1),
    [roomCapacity],
  );

  const startIso = useMemo(() => {
    const ms = Date.parse(start);
    return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
  }, [start]);

  const requestedSlot = useMemo(() => {
    if (!registrySpot || !registrySpot.bookingUrl || !startIso) return null;
    return slotRequestForSpot(registrySpot, startIso);
  }, [registrySpot, startIso]);

  const { availability, checking: checkingSlot } = useLibcalAvailability(requestedSlot);

  const slot = useMemo(() => {
    if (!requestedSlot) return null;
    const request = availability?.startIso
      ? { ...requestedSlot, startIso: availability.startIso }
      : requestedSlot;
    return {
      request,
      url: slotDeepLink(request),
      message: selectionMessage(request),
      requestedMessage: selectionMessage(requestedSlot),
      shifted: Boolean(availability?.shifted),
    };
  }, [requestedSlot, availability]);

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

    // Open the LibCal grid synchronously so popup blockers allow it.
    const target = slot
      ? autofillHelperPath(slot.request)
      : spot.bookingUrl;
    if (target) window.open(target, "_blank", "noopener,noreferrer");

    try {
      // Subscribing first means the host's own booking email goes out to a
      // list that already includes everyone else who opted in.
      if (email.trim()) {
        setNotifyEmail(email.trim());
        const codes = Array.from(
          new Set([
            resolvedCourse,
            ...courses.map((c) => c.courseCode),
            ...adjacent.map((a) => a.courseCode),
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
        bookingUrl: spot.bookingUrl,
        start: snapToGrid(slot?.request.startIso ?? startIso),
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
              ? "Opens the Yale booking page on the right day so Autofill can skip red booked cells and click the earliest green slot, then tells your class you have a room."
              : "Tells your class you will be here. No booking needed."}{" "}
            Classmates in {resolvedCourse || "your course"}
            {adjacent.length > 0
              ? ` and ${adjacent.map((a) => a.courseCode).join(", ")}`
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
              <Label htmlFor="book-cap">Seats</Label>
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
                {published
                  ? `schedule.yale.edu lists ${roomCapacity} seat${roomCapacity === 1 ? "" : "s"}; the pool cannot exceed that.`
                  : `Fits about ${roomCapacity}.`}
              </p>
            </div>
          </div>

          {slot ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 font-normal">
                  <CalendarCheck className="size-3" aria-hidden />
                  Autofill timeslot
                </Badge>
                <code className="text-xs">{checkingSlot ? "Checking Yale…" : slot.message}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                {checkingSlot
                  ? "Checking Yale for red (booked) vs green (open) cells…"
                  : slot.shifted
                    ? `${slot.requestedMessage} is already booked. Autofill will click the earliest green start instead.`
                    : "Autofill skips red booked cells and clicks the earliest green start. Leave the end-time dropdown alone so Yale keeps its default length."}
              </p>
              <AutofillTimeslotButton
                spotName={spot?.name ?? ""}
                startIso={slot.request.startIso}
                variant="outline"
              />
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
            {isRoom ? "Book & announce" : "Announce"}
          </DebouncedSubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

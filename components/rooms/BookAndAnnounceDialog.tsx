"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { normalizeCourseCode, similarCourses } from "@/lib/courseSimilarity";
import { announceBooking } from "@/lib/hooks/queue";
import { getDisplayName, setDisplayName as persistDisplayName } from "@/lib/identity";
import { failsProfanityCheck } from "@/lib/profanity";
import type { StudyRecommendation } from "@/lib/types";

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
  onOpenChange,
}: {
  /** The spot being booked; null closes the dialog. */
  spot: StudyRecommendation | null;
  /** Course codes from the user's schedule, for the picker. */
  courses: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [customCourse, setCustomCourse] = useState("");
  const [start, setStart] = useState(nextHourLocal);
  const [capacity, setCapacity] = useState("4");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!spot) return;
    const timer = window.setTimeout(() => {
      setName((n) => n || getDisplayName());
      setCourse((c) => c || courses[0] || "custom");
      setStart(nextHourLocal());
      setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [spot, courses]);

  const resolvedCourse = normalizeCourseCode(course === "custom" ? customCourse : course);
  const adjacent = resolvedCourse ? similarCourses(resolvedCourse, 4) : [];
  const isRoom = spot?.kind === "room";

  async function submit() {
    if (!spot) return;
    if (!name.trim()) return setError("Display name is required.");
    if (failsProfanityCheck(name)) return setError("Display name failed the 5-word check.");
    if (!resolvedCourse || !/^[A-Z&]{2,5} \d{3}[A-Z]?$/.test(resolvedCourse)) {
      return setError("Enter a course code like CPSC 223.");
    }
    const startMs = Date.parse(start);
    if (Number.isNaN(startMs)) return setError("Pick a start time.");
    setError("");
    persistDisplayName(name.trim());

    // Open the booking page synchronously so popup blockers allow it.
    if (spot.bookingUrl) window.open(spot.bookingUrl, "_blank", "noopener,noreferrer");

    try {
      await announceBooking({
        courseCode: resolvedCourse,
        displayName: name.trim(),
        spotName: spot.name,
        bookingUrl: spot.bookingUrl,
        start: new Date(startMs).toISOString(),
        capacity: Number(capacity),
      });
      onOpenChange(false);
      router.push(`/pools?course=${encodeURIComponent(resolvedCourse)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not announce booking");
    }
  }

  return (
    <Dialog open={spot !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRoom ? "Book" : "Meet at"} {spot?.name ?? ""}
          </DialogTitle>
          <DialogDescription>
            {isRoom
              ? "Opens the Yale booking page in a new tab and tells your class you have a room."
              : "Tells your class you will be here. No booking needed."}{" "}
            Classmates in {resolvedCourse || "your course"}
            {adjacent.length > 0
              ? ` and ${adjacent.map((a) => a.courseCode).join(", ")}`
              : ""}{" "}
            will see it on the Pools page.
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
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Other…</SelectItem>
              </SelectContent>
            </Select>
            {course === "custom" ? (
              <Input
                placeholder="MATH 225"
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
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-cap">Seats</Label>
              <Select value={capacity} onValueChange={setCapacity}>
                <SelectTrigger id="book-cap" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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

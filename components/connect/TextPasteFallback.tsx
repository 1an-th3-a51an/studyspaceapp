"use client";

import { useState } from "react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { parseCalendarText } from "@/lib/icsParse";
import {
  setCourseTableEvents,
  setGcalEvents,
} from "@/lib/scheduleStore";
import type { EventSource } from "@/lib/types";

export function TextPasteFallback() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<Extract<EventSource, "gcal" | "coursetable-ics">>(
    "coursetable-ics",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Label htmlFor="calendar-paste">Parse pasted calendar text</Label>
        <Select
          value={source}
          onValueChange={(value) =>
            setSource(value as Extract<EventSource, "gcal" | "coursetable-ics">)
          }
        >
          <SelectTrigger className="min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="coursetable-ics">Treat as CourseTable</SelectItem>
            <SelectItem value="gcal">Treat as Google Calendar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        id="calendar-paste"
        rows={8}
        placeholder="Paste BEGIN:VCALENDAR … or lines like S&DS 2380 Lecture 2026-09-14T13:05:00-04:00"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <DebouncedSubmitButton
        onSubmit={() => {
          setError("");
          setMessage("");
          const events = parseCalendarText(text, source);
          if (events.length === 0) {
            setError("No events found. Paste ICS or a line with an ISO timestamp.");
            return;
          }
          if (source === "gcal") setGcalEvents(events);
          else setCourseTableEvents(events);
          setMessage(`Parsed ${events.length} event${events.length === 1 ? "" : "s"}.`);
        }}
      >
        Parse pasted calendar text
      </DebouncedSubmitButton>
    </div>
  );
}

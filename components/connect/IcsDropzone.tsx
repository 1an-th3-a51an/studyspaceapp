"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCalendarText } from "@/lib/icsParse";
import {
  setCourseTableEvents,
  setGcalEvents,
} from "@/lib/scheduleStore";
import type { EventSource } from "@/lib/types";

export function IcsDropzone({
  label,
  source,
}: {
  label: string;
  source: Extract<EventSource, "gcal" | "coursetable-ics">;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("Drop a .ics file or browse");
  const [error, setError] = useState<string>("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      const events = parseCalendarText(text, source);
      if (events.length === 0) {
        setError("No events found in that file.");
        return;
      }
      if (source === "gcal") setGcalEvents(events);
      else setCourseTableEvents(events);
      setStatus(`Loaded ${events.length} event${events.length === 1 ? "" : "s"} from ${file.name}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read file");
    }
  }

  return (
    <Card
      role="button"
      aria-label={label}
      className="cursor-pointer border-dashed"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void handleFile(event.dataTransfer.files[0]);
      }}
    >
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">{status}</p>
        {error ? <p className="text-destructive">{error}</p> : null}
        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}

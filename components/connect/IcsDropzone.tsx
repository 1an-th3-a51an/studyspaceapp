"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCalendar } from "@/lib/icsParse";
import { setCalendarImport } from "@/lib/scheduleStore";
import type { ParsedCalendarSource } from "@/lib/types";

export function IcsDropzone({
  label,
  source,
}: {
  label: string;
  source: ParsedCalendarSource;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("Drop a .ics file or browse");
  const [error, setError] = useState<string>("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const text = await file.text();
      const parsed = parseCalendar(text, source);
      if (parsed.meetings.length === 0 && parsed.deadlines.length === 0) {
        setError("No events found in that file.");
        return;
      }
      setCalendarImport(source, parsed);
      const parts = [
        `${parsed.meetings.length} class meeting${parsed.meetings.length === 1 ? "" : "s"}`,
      ];
      if (parsed.deadlines.length > 0) {
        parts.push(
          `${parsed.deadlines.length} deadline${parsed.deadlines.length === 1 ? "" : "s"}`,
        );
      }
      setStatus(
        `Loaded ${parts.join(" and ")} from ${file.name}. Schedule, Pools, and Rooms now use this calendar.`,
      );
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

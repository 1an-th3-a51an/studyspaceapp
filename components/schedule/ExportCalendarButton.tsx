"use client";

import { useState } from "react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { downloadGeneratedIcs } from "@/lib/hooks/generateIcs";
import type { ClassMeeting, GenerateIcsEvent } from "@/lib/types";

export function ExportCalendarButton({ meetings }: { meetings: ClassMeeting[] }) {
  const [error, setError] = useState("");

  const events: GenerateIcsEvent[] = meetings.map((meeting) => ({
    summary: `${meeting.courseCode} ${meeting.title}`.trim(),
    dtstart: meeting.start,
  }));

  return (
    <div className="space-y-2">
      <DebouncedSubmitButton
        variant="outline"
        disabled={events.length === 0}
        onSubmit={async () => {
          setError("");
          try {
            await downloadGeneratedIcs(events);
          } catch (caught) {
            const message =
              caught instanceof Error
                ? caught.message
                : "Calendar export failed";
            setError(message);
          }
        }}
      >
        Export to Calendar
      </DebouncedSubmitButton>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

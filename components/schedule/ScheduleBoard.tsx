"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTimeRange } from "@/lib/format";
import type { ClassMeeting } from "@/lib/types";

function classHeading(meeting: ClassMeeting): string {
  const title = meeting.title.trim();
  if (
    !title ||
    title === meeting.courseCode ||
    /^(lecture|discussion|seminar|section|lab|recitation|studio|class)$/i.test(title)
  ) {
    return meeting.courseCode;
  }
  return `${meeting.courseCode} · ${title}`;
}

export function ScheduleBoard({
  meetings,
  demo,
}: {
  meetings: ClassMeeting[];
  demo: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classes</CardTitle>
        <CardDescription>
          {demo
            ? "Handsome Dan demo dataset (local, no LLM)."
            : "Your connected calendars, with recurring classes expanded. Google Calendar wins on the same start-minute + title."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classes yet. Connect an .ics or start Demo Mode.
          </p>
        ) : (
          meetings.map((meeting) => (
            <div
              key={`${meeting.start}-${meeting.courseCode}-${meeting.title}`}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{classHeading(meeting)}</p>
                <Badge variant="secondary">{meeting.source}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatTimeRange(meeting.start, meeting.end)}
                {meeting.location ? ` · ${meeting.location}` : ""}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

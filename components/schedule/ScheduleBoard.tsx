"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTimeRange, formatWhen } from "@/lib/format";
import type { ClassMeeting, Deadline } from "@/lib/types";

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
  deadlines,
  demo,
}: {
  meetings: ClassMeeting[];
  deadlines: Deadline[];
  demo: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
          <CardDescription>
            {demo
              ? "Handsome Dan demo dataset (local, no LLM)."
              : "Merged calendar. Google Calendar wins on the same start-minute + title."}
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
                  <p className="font-medium">
                    {classHeading(meeting)}
                  </p>
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
      <Card>
        <CardHeader>
          <CardTitle>Deadlines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deadlines loaded.</p>
          ) : (
            deadlines.map((item) => (
              <div
                key={`${item.due}-${item.title}`}
                className="rounded-lg border bg-background p-3"
              >
                <p className="font-medium">
                  {item.courseCode} · {item.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  Due {formatWhen(item.due)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

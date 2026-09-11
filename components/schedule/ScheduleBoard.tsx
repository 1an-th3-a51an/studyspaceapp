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
import type { ClassMeeting, Deadline, OfficeHour } from "@/lib/types";

export function ScheduleBoard({
  meetings,
  deadlines,
  officeHours,
  demo,
}: {
  meetings: ClassMeeting[];
  deadlines: Deadline[];
  officeHours: OfficeHour[];
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
              No meetings yet. Connect an .ics or start Demo Mode.
            </p>
          ) : (
            meetings.map((meeting) => (
              <div
                key={`${meeting.start}-${meeting.title}`}
                className="rounded-lg border bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {meeting.courseCode} · {meeting.title}
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
      <div className="space-y-6">
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
        {officeHours.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Office hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {officeHours.map((item) => (
                <p
                  key={`${item.start}-${item.location ?? ""}`}
                  className="text-sm"
                >
                  {formatTimeRange(item.start, item.end)}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

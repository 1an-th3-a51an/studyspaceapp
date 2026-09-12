"use client";

import Link from "next/link";
import { ExportCalendarButton } from "@/components/schedule/ExportCalendarButton";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_DISPLAY_NAME } from "@/lib/demo/handsomeDan";
import { useSchedule } from "@/lib/hooks/useSchedule";
import { getDisplayName } from "@/lib/identity";
import { useEffect, useState } from "react";

export default function SchedulePage() {
  const schedule = useSchedule();
  const [name, setName] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setName(getDisplayName()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const subtitle =
    schedule.origin === "imported"
      ? `${schedule.courses.length} course${schedule.courses.length === 1 ? "" : "s"} from your connected calendars`
      : schedule.origin === "demo"
        ? `${name || DEMO_DISPLAY_NAME} · demo data, replaced as soon as you connect a calendar`
        : "Nothing connected yet";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Schedule
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{subtitle}</p>
            {schedule.origin === "demo" ? <Badge variant="outline">Demo data</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/connect">
              {schedule.origin === "imported" ? "Manage calendars" : "Connect a calendar"}
            </Link>
          </Button>
          <ExportCalendarButton meetings={schedule.meetings} />
        </div>
      </div>
      <ScheduleBoard
        meetings={schedule.meetings}
        demo={schedule.origin === "demo"}
      />
    </div>
  );
}

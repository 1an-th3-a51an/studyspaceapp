"use client";

import { useEffect, useMemo, useState } from "react";
import { ExportCalendarButton } from "@/components/schedule/ExportCalendarButton";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import {
  DEMO_DEADLINES,
  DEMO_DISPLAY_NAME,
  DEMO_MEETINGS,
  DEMO_SYLLABUS,
} from "@/lib/demo/handsomeDan";
import { getDisplayName, isDemoMode } from "@/lib/identity";
import { mergeDeadlines, mergeSchedule } from "@/lib/scheduleMerge";
import { getCourseTableEvents, getGcalEvents } from "@/lib/scheduleStore";
import type { ClassMeeting, Deadline, OfficeHour } from "@/lib/types";

export default function SchedulePage() {
  const [demo, setDemo] = useState(false);
  const [name, setName] = useState("");
  const [gcal, setGcal] = useState<ClassMeeting[]>([]);
  const [courseTable, setCourseTable] = useState<ClassMeeting[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDemo(isDemoMode());
      setName(getDisplayName());
      setGcal(getGcalEvents());
      setCourseTable(getCourseTableEvents());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const meetings = useMemo(
    () =>
      mergeSchedule({
        gcal,
        coursetable: courseTable,
        demo,
        demoMeetings: DEMO_MEETINGS,
      }),
    [gcal, courseTable, demo],
  );

  const deadlines: Deadline[] = useMemo(
    () =>
      mergeDeadlines({
        gcal: [],
        coursetable: [],
        demo,
        demoDeadlines: DEMO_DEADLINES,
      }),
    [demo],
  );

  const officeHours: OfficeHour[] = demo ? DEMO_SYLLABUS.officeHours : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            {demo
              ? `${name || DEMO_DISPLAY_NAME} · demo data from handsomeDan.ts`
              : "Live merge of uploaded calendars"}
          </p>
        </div>
        <ExportCalendarButton meetings={meetings} />
      </div>
      <ScheduleBoard
        meetings={meetings}
        deadlines={deadlines}
        officeHours={officeHours}
        demo={demo}
      />
    </div>
  );
}

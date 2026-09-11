"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEMO_DEADLINES,
  DEMO_MEETINGS,
} from "@/lib/demo/handsomeDan";
import { isDemoMode } from "@/lib/identity";
import { coursesFromMeetings, mergeDeadlines, mergeSchedule } from "@/lib/scheduleMerge";
import {
  getCourseTableDeadlines,
  getCourseTableEvents,
  getGcalDeadlines,
  getGcalEvents,
  SCHEDULE_CHANGED_EVENT,
} from "@/lib/scheduleStore";
import type { ClassMeeting, Deadline, MyCourse } from "@/lib/types";

export type ScheduleOrigin = "imported" | "demo" | "empty";

export type MySchedule = {
  meetings: ClassMeeting[];
  deadlines: Deadline[];
  /** One entry per course on the schedule, sorted by code. */
  courses: MyCourse[];
  /** The course of the next upcoming class, else the first course. */
  primaryCourseCode: string;
  /** Where the data came from, so pages can label it honestly. */
  origin: ScheduleOrigin;
  /** False until the first client-side read of localStorage completes. */
  ready: boolean;
  reload: () => void;
};

const EMPTY: Omit<MySchedule, "reload"> = {
  meetings: [],
  deadlines: [],
  courses: [],
  primaryCourseCode: "",
  origin: "empty",
  ready: false,
};

function read(): Omit<MySchedule, "reload"> {
  const gcal = getGcalEvents();
  const coursetable = getCourseTableEvents();
  const demo = isDemoMode();
  const hasImportedMeetings = gcal.length > 0 || coursetable.length > 0;

  const meetings = mergeSchedule({
    gcal,
    coursetable,
    demo,
    demoMeetings: DEMO_MEETINGS,
  });
  const deadlines = mergeDeadlines({
    gcal: getGcalDeadlines(),
    coursetable: getCourseTableDeadlines(),
    demo,
    demoDeadlines: DEMO_DEADLINES,
    hasImportedMeetings,
  });
  const courses = coursesFromMeetings(meetings);
  // `courses` is sorted by code for the pickers, so the default course has to
  // be chosen by soonest meeting rather than by taking the first entry.
  const soonest = courses
    .filter((c) => c.nextStart)
    .sort((a, b) => a.nextStart!.localeCompare(b.nextStart!))[0];

  return {
    meetings,
    deadlines,
    courses,
    primaryCourseCode: soonest?.courseCode ?? courses[0]?.courseCode ?? "",
    origin: hasImportedMeetings ? "imported" : meetings.length > 0 ? "demo" : "empty",
    ready: true,
  };
}

/**
 * The one place any page asks "what is this user taking?".
 *
 * Reads on mount rather than during render so the server and first client
 * render agree, then re-reads when an import fires SCHEDULE_CHANGED_EVENT or
 * another tab writes to localStorage.
 */
export function useSchedule(): MySchedule {
  const [state, setState] = useState(EMPTY);

  const reload = useCallback(() => {
    setState(read());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    window.addEventListener(SCHEDULE_CHANGED_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  return { ...state, reload };
}

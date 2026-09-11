import type { ClassMeeting, Deadline, MyCourse } from "@/lib/types";

function truncateToMinute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function normalizedTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function eventMergeKey(start: string, title: string): string {
  return `${truncateToMinute(start)}|${normalizedTitle(title)}`;
}

/**
 * Merge imported calendars, falling back to the demo dataset only when the
 * user has imported nothing.
 *
 * Demo mode is a way to see the app with data, not a mode that overrides real
 * data: the moment a .ics is connected, every page follows the .ics.
 */
export function mergeSchedule(options: {
  gcal: ClassMeeting[];
  coursetable: ClassMeeting[];
  demo: boolean;
  demoMeetings: ClassMeeting[];
}): ClassMeeting[] {
  const merged = new Map<string, ClassMeeting>();
  for (const event of options.coursetable) {
    merged.set(eventMergeKey(event.start, event.title), event);
  }
  for (const event of options.gcal) {
    merged.set(eventMergeKey(event.start, event.title), event);
  }
  if (merged.size === 0 && options.demo) return [...options.demoMeetings];
  return Array.from(merged.values()).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}

export function mergeDeadlines(options: {
  gcal: Deadline[];
  coursetable: Deadline[];
  demo: boolean;
  demoDeadlines: Deadline[];
  /** When the user has imported classes, stop showing demo due dates. */
  hasImportedMeetings?: boolean;
}): Deadline[] {
  const merged = new Map<string, Deadline>();
  for (const item of options.coursetable) {
    merged.set(eventMergeKey(item.due, item.title), item);
  }
  for (const item of options.gcal) {
    merged.set(eventMergeKey(item.due, item.title), item);
  }
  if (merged.size === 0 && options.demo && !options.hasImportedMeetings) {
    return [...options.demoDeadlines];
  }
  return Array.from(merged.values()).sort((a, b) => a.due.localeCompare(b.due));
}

/**
 * Collapse meetings into the user's course list.
 *
 * One entry per course code, titled from the first meeting that carries a real
 * title, and annotated with the next upcoming meeting so the Rooms page can
 * anchor a search on "where AMST 1197 meets next".
 */
export function coursesFromMeetings(
  meetings: ClassMeeting[],
  now = Date.now(),
): MyCourse[] {
  const byCode = new Map<string, MyCourse>();

  for (const meeting of [...meetings].sort((a, b) => a.start.localeCompare(b.start))) {
    const code = meeting.courseCode?.trim();
    if (!code || code === "UNKNOWN") continue;
    const existing = byCode.get(code);
    const title = meeting.title?.trim() ?? "";
    const isUpcoming = Date.parse(meeting.end) > now;

    if (!existing) {
      byCode.set(code, {
        courseCode: code,
        title: title && title !== code ? title : code,
        location: meeting.location,
        nextStart: isUpcoming ? meeting.start : undefined,
      });
      continue;
    }
    if (existing.title === code && title && title !== code) existing.title = title;
    // The first upcoming meeting wins, since meetings are sorted by start.
    if (!existing.nextStart && isUpcoming) {
      existing.nextStart = meeting.start;
      existing.location = meeting.location ?? existing.location;
    }
    if (!existing.location && meeting.location) existing.location = meeting.location;
  }

  return Array.from(byCode.values()).sort((a, b) =>
    a.courseCode.localeCompare(b.courseCode),
  );
}

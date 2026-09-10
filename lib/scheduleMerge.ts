import type { ClassMeeting, Deadline } from "@/lib/types";

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

export function mergeSchedule(options: {
  gcal: ClassMeeting[];
  coursetable: ClassMeeting[];
  demo: boolean;
  demoMeetings: ClassMeeting[];
}): ClassMeeting[] {
  if (options.demo) return [...options.demoMeetings];

  const merged = new Map<string, ClassMeeting>();
  for (const event of options.coursetable) {
    merged.set(eventMergeKey(event.start, event.title), event);
  }
  for (const event of options.gcal) {
    merged.set(eventMergeKey(event.start, event.title), event);
  }
  return Array.from(merged.values()).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}

export function mergeDeadlines(options: {
  gcal: Deadline[];
  coursetable: Deadline[];
  demo: boolean;
  demoDeadlines: Deadline[];
}): Deadline[] {
  if (options.demo) return [...options.demoDeadlines];
  const merged = new Map<string, Deadline>();
  for (const item of options.coursetable) {
    merged.set(eventMergeKey(item.due, item.title), item);
  }
  for (const item of options.gcal) {
    merged.set(eventMergeKey(item.due, item.title), item);
  }
  return Array.from(merged.values()).sort((a, b) => a.due.localeCompare(b.due));
}

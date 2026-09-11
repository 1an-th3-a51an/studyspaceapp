import type { ClassMeeting, Deadline, EventSource } from "@/lib/types";
import { extractCourseCode } from "@/lib/courseSimilarity";

/** One unfolded ICS property: `DTSTART;TZID=America/New_York:20260914T130500`. */
type IcsProp = { name: string; params: Record<string, string>; value: string };

type IcsComponent = { type: string; props: IcsProp[] };

/** A wall-clock instant plus whether the source had a time at all. */
type IcsMoment = { ms: number; dateOnly: boolean };

/** A weekly lecture over a 14-week term is ~28 events; 400 is slack for dailies. */
const MAX_OCCURRENCES = 400;
/** Never expand more than roughly one academic year past the first occurrence. */
const MAX_HORIZON_DAYS = 400;

const DAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function unfoldIcs(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const folded = normalized.split("\n");
  const lines: string[] = [];
  for (const line of folded) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\r\\n/gi, "\n")
    .replace(/\\n/gi, "\n")
    .replace(/\\r/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseProp(line: string): IcsProp | null {
  const splitAt = line.indexOf(":");
  if (splitAt === -1) return null;
  const head = line.slice(0, splitAt);
  const value = line.slice(splitAt + 1);
  const [rawName, ...rawParams] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of rawParams) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: rawName.toUpperCase(), params, value };
}

function firstProp(component: IcsComponent, name: string): IcsProp | undefined {
  return component.props.find((p) => p.name === name);
}

function textOf(component: IcsComponent, name: string): string {
  const prop = firstProp(component, name);
  return prop ? unescapeIcs(prop.value).trim() : "";
}

/**
 * ICS timestamps come in three flavours: UTC (`...Z`), floating/zoned local
 * (`20260914T130500`, optionally with TZID), and date-only (`20260917`).
 *
 * Zoned values are read as the viewer's local wall clock. Yale calendars are
 * all America/New_York, so for anyone actually on campus this is exact, and it
 * keeps a 1:05pm class at 1:05pm instead of shifting it by the UTC offset.
 */
function icsDateToMoment(prop: IcsProp | undefined): IcsMoment | null {
  if (!prop) return null;
  const compact = prop.value.trim();
  if (!compact) return null;
  const digits = compact.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  const dateOnly = prop.params.VALUE === "DATE" || digits.length === 8;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10) || "0");
  const minute = Number(digits.slice(10, 12) || "0");
  const second = Number(digits.slice(12, 14) || "0");
  if (!year || !month || !day) return null;

  const ms = compact.endsWith("Z")
    ? Date.UTC(year, month - 1, day, hour, minute, second)
    : new Date(year, month - 1, day, hour, minute, second).getTime();
  return Number.isNaN(ms) ? null : { ms, dateOnly };
}

function parseRule(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return out;
}

function addDays(ms: number, days: number): number {
  // Day arithmetic on a local Date keeps the wall-clock time across DST, so a
  // 1:05pm class stays 1:05pm when the clocks change mid-semester.
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * Expand an RRULE into start timestamps.
 *
 * Google Calendar exports a recurring class as one VEVENT plus an RRULE, so
 * without this a connected calendar shows a single meeting per course for the
 * whole term. Handles the shapes real course calendars use — WEEKLY with
 * BYDAY, and DAILY — and degrades to a single occurrence for anything else.
 */
function expandRecurrence(
  startMs: number,
  rrule: string | undefined,
  exdates: number[],
): number[] {
  if (!rrule) return [startMs];
  const rule = parseRule(rrule);
  const freq = (rule.FREQ ?? "").toUpperCase();
  if (freq !== "WEEKLY" && freq !== "DAILY") return [startMs];

  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = Number(rule.COUNT) || 0;
  const untilMoment = rule.UNTIL
    ? icsDateToMoment({ name: "UNTIL", params: {}, value: rule.UNTIL })
    : null;
  const horizonMs = addDays(startMs, MAX_HORIZON_DAYS);
  const limitMs = Math.min(untilMoment?.ms ?? horizonMs, horizonMs);
  const skip = new Set(exdates);

  const byDay = (rule.BYDAY ?? "")
    .split(",")
    .map((d) => DAY_INDEX[d.trim().slice(-2).toUpperCase()])
    .filter((d): d is number => typeof d === "number");

  const out: number[] = [];
  const push = (ms: number) => {
    if (ms < startMs || ms > limitMs) return;
    if (skip.has(ms)) return;
    out.push(ms);
  };

  if (freq === "DAILY") {
    for (let ms = startMs; ms <= limitMs && out.length < MAX_OCCURRENCES; ms = addDays(ms, interval)) {
      push(ms);
    }
  } else if (byDay.length === 0) {
    for (let ms = startMs; ms <= limitMs && out.length < MAX_OCCURRENCES; ms = addDays(ms, 7 * interval)) {
      push(ms);
    }
  } else {
    // Walk week by week from the Sunday of the start week, emitting each BYDAY.
    const weekStart = addDays(startMs, -new Date(startMs).getDay());
    for (
      let week = weekStart;
      week <= limitMs && out.length < MAX_OCCURRENCES;
      week = addDays(week, 7 * interval)
    ) {
      for (const day of [...byDay].sort((a, b) => a - b)) {
        if (out.length >= MAX_OCCURRENCES) break;
        push(addDays(week, day));
      }
    }
  }

  out.sort((a, b) => a - b);
  const capped = count > 0 ? out.slice(0, count) : out;
  return capped.length > 0 ? capped : [startMs];
}

function isMeetingKind(text: string): boolean {
  return /^(lecture|discussion|seminar|section|lab|recitation|studio|class)$/i.test(
    text.trim(),
  );
}

function looksLikeCourseCode(text: string): boolean {
  const code = extractCourseCode(text);
  if (code === "UNKNOWN") return false;
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = text
    .replace(/&amp;/gi, "&")
    .replace(new RegExp(escaped, "i"), "")
    .replace(/[-–—|/.,]+/g, " ")
    .replace(/\b\d{2}\b/g, "")
    .trim();
  return stripped.length === 0;
}

function firstMeaningfulLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^instructor\s*:/i.test(trimmed)) continue;
    if (looksLikeCourseCode(trimmed)) continue;
    if (isMeetingKind(trimmed)) continue;
    return trimmed;
  }
  return "";
}

/**
 * CourseTable puts the catalog code in SUMMARY ("S&DS 2380") and the real
 * title on the first line of DESCRIPTION. GCal / pasted lines may already
 * have a human title in SUMMARY — keep that when it is more than the code.
 */
export function extractEventTitle(
  summary: string,
  description = "",
  courseCode = extractCourseCode(summary),
): string {
  const fromDesc = firstMeaningfulLine(description);
  const escapedCode = courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const remainder = summary
    .replace(/&amp;/gi, "&")
    .replace(new RegExp(escapedCode, "i"), "")
    .replace(/[-–—|]+/g, " ")
    .replace(/\b\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (looksLikeCourseCode(summary) && fromDesc && !looksLikeCourseCode(fromDesc)) {
    return fromDesc;
  }
  if (remainder.length >= 3 && !looksLikeCourseCode(remainder) && !isMeetingKind(remainder)) {
    return remainder;
  }
  if (fromDesc && !looksLikeCourseCode(fromDesc) && !isMeetingKind(fromDesc)) return fromDesc;
  return "";
}

/** Words that mean "something is due" rather than "class meets". */
const DEADLINE_RE =
  /\b(due|deadline|assignment|problem\s*set|p-?set|homework|hw\s*\d|essay|paper|draft|submit|submission|turn\s*in|quiz|midterm|exam|final|presentation|lab\s*report|response|reading\s*response|milestone|checkpoint)\b/i;

/** A class meeting is long; a due date is a pin on the calendar. */
const SHORT_EVENT_MS = 30 * 60 * 1000;

/**
 * An all-day due date means "by the end of that day", not "by midnight as it
 * begins". Calendars encode it as a bare date, so move it to 23:59 local.
 */
function endOfDayIfDateOnly(ms: number, dateOnly: boolean): number {
  if (!dateOnly) return ms;
  const d = new Date(ms);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

function looksLikeDeadline(title: string, durationMs: number, dateOnly: boolean): boolean {
  if (!DEADLINE_RE.test(title)) return false;
  // "Midterm exam" in a 2-hour block is still a thing you attend, but an
  // all-day or near-instant event with deadline wording is a due date.
  return dateOnly || durationMs <= SHORT_EVENT_MS;
}

export type ParsedCalendar = {
  meetings: ClassMeeting[];
  deadlines: Deadline[];
};

function splitComponents(raw: string): IcsComponent[] {
  const out: IcsComponent[] = [];
  const stack: IcsComponent[] = [];
  for (const line of unfoldIcs(raw)) {
    const prop = parseProp(line);
    if (!prop) continue;
    if (prop.name === "BEGIN") {
      stack.push({ type: prop.value.trim().toUpperCase(), props: [] });
      continue;
    }
    if (prop.name === "END") {
      const done = stack.pop();
      if (done) out.push(done);
      continue;
    }
    stack[stack.length - 1]?.props.push(prop);
  }
  return out;
}

function parseIcsCalendar(raw: string, source: EventSource): ParsedCalendar {
  const meetings: ClassMeeting[] = [];
  const deadlines: Deadline[] = [];

  for (const component of splitComponents(raw)) {
    if (component.type !== "VEVENT" && component.type !== "VTODO") continue;

    const summary = textOf(component, "SUMMARY");
    const description = textOf(component, "DESCRIPTION");
    const location = textOf(component, "LOCATION");
    const courseCode = extractCourseCode(`${summary}\n${description}`);
    const title = extractEventTitle(summary, description, courseCode) || summary;
    if (!title) continue;

    // VTODO carries DUE; VEVENT carries DTSTART/DTEND.
    const startMoment =
      icsDateToMoment(firstProp(component, "DTSTART")) ??
      icsDateToMoment(firstProp(component, "DUE"));
    if (!startMoment) continue;
    const endMoment = icsDateToMoment(firstProp(component, "DTEND"));
    const durationMs = endMoment ? Math.max(0, endMoment.ms - startMoment.ms) : 0;

    if (
      component.type === "VTODO" ||
      looksLikeDeadline(`${summary} ${description}`, durationMs, startMoment.dateOnly)
    ) {
      deadlines.push({
        courseCode,
        title,
        due: new Date(
          endOfDayIfDateOnly(startMoment.ms, startMoment.dateOnly),
        ).toISOString(),
        source,
      });
      continue;
    }

    const exdates = component.props
      .filter((p) => p.name === "EXDATE")
      .flatMap((p) =>
        p.value
          .split(",")
          .map((v) => icsDateToMoment({ ...p, value: v })?.ms)
          .filter((ms): ms is number => typeof ms === "number"),
      );
    const lengthMs = durationMs > 0 ? durationMs : 60 * 60 * 1000;

    for (const occurrenceMs of expandRecurrence(
      startMoment.ms,
      firstProp(component, "RRULE")?.value,
      exdates,
    )) {
      meetings.push({
        courseCode,
        title,
        location: location || undefined,
        start: new Date(occurrenceMs).toISOString(),
        end: new Date(occurrenceMs + lengthMs).toISOString(),
        source,
      });
    }
  }

  return { meetings, deadlines };
}

function parseLineCalendar(raw: string, source: EventSource): ParsedCalendar {
  const meetings: ClassMeeting[] = [];
  const deadlines: Deadline[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isoMatch = trimmed.match(
      /(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?)?)/,
    );
    if (!isoMatch) continue;
    const stamp = isoMatch[1];
    const dateOnly = !stamp.includes("T");
    const remainder =
      trimmed.replace(stamp, "").replace(/[|@,-]+/g, " ").trim() || "Untitled";
    const startDate = new Date(dateOnly ? `${stamp}T23:59:00` : stamp);
    if (Number.isNaN(startDate.getTime())) continue;


    const courseCode = extractCourseCode(remainder);
    const title = extractEventTitle(remainder, "", courseCode) || remainder;

    if (looksLikeDeadline(remainder, 0, dateOnly)) {
      deadlines.push({
        courseCode,
        title,
        due: startDate.toISOString(),
        source,
      });
      continue;
    }
    meetings.push({
      courseCode,
      title,
      start: startDate.toISOString(),
      end: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
      source,
    });
  }

  return { meetings, deadlines };
}

/** Parse a .ics file or a list of timestamped lines into classes and due dates. */
export function parseCalendar(raw: string, source: EventSource): ParsedCalendar {
  const text = raw.trim();
  if (!text) return { meetings: [], deadlines: [] };
  if (text.includes("BEGIN:VCALENDAR") || text.includes("BEGIN:VEVENT")) {
    return parseIcsCalendar(text, source);
  }
  return parseLineCalendar(text, source);
}

/** Meetings only, for callers that do not care about due dates. */
export function parseCalendarText(raw: string, source: EventSource): ClassMeeting[] {
  return parseCalendar(raw, source).meetings;
}

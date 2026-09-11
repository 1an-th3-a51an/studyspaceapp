import type { ClassMeeting, EventSource } from "@/lib/types";
import { extractCourseCode } from "@/lib/courseSimilarity";

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

function icsDateToIso(value: string): string {
  const compact = value.trim();
  const zulu = compact.endsWith("Z");
  const digits = compact.replace(/[^\d]/g, "");
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10) || "0");
  const minute = Number(digits.slice(10, 12) || "0");
  const second = Number(digits.slice(12, 14) || "0");

  if (zulu) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }
  return new Date(year, month - 1, day, hour, minute, second).toISOString();
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

function parseIcsEvents(raw: string, source: EventSource): ClassMeeting[] {
  const lines = unfoldIcs(raw);
  const events: ClassMeeting[] = [];
  let inEvent = false;
  let summary = "";
  let description = "";
  let location = "";
  let start = "";
  let end = "";

  const flush = () => {
    if (!summary || !start) return;
    const startIso = icsDateToIso(start);
    const endIso = end
      ? icsDateToIso(end)
      : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    const haystack = `${summary}\n${description}`;
    const courseCode = extractCourseCode(haystack);
    events.push({
      courseCode,
      title: extractEventTitle(summary, description, courseCode),
      location: location || undefined,
      start: startIso,
      end: endIso,
      source,
    });
  };

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      summary = "";
      description = "";
      location = "";
      start = "";
      end = "";
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent) flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const splitAt = line.indexOf(":");
    if (splitAt === -1) continue;
    const key = line.slice(0, splitAt).split(";")[0].toUpperCase();
    const value = unescapeIcs(line.slice(splitAt + 1));
    if (key === "SUMMARY") summary = value;
    if (key === "DESCRIPTION") description = value;
    if (key === "LOCATION") location = value;
    if (key === "DTSTART") start = value;
    if (key === "DTEND") end = value;
  }

  return events;
}

function parseLineEvents(raw: string, source: EventSource): ClassMeeting[] {
  const events: ClassMeeting[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isoMatch = trimmed.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?)/,
    );
    if (!isoMatch) continue;
    const start = isoMatch[1];
    const remainder =
      trimmed.replace(isoMatch[1], "").replace(/[|@,-]+/g, " ").trim() ||
      "Untitled";
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) continue;
    const courseCode = extractCourseCode(remainder);
    events.push({
      courseCode,
      title: extractEventTitle(remainder, "", courseCode),
      start: startDate.toISOString(),
      end: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
      source,
    });
  }
  return events;
}

export function parseCalendarText(
  raw: string,
  source: EventSource,
): ClassMeeting[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.includes("BEGIN:VCALENDAR") || text.includes("BEGIN:VEVENT")) {
    return parseIcsEvents(text, source);
  }
  return parseLineEvents(text, source);
}

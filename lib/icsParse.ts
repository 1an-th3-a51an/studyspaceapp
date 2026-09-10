import type { ClassMeeting, EventSource } from "@/lib/types";

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

function extractCourseCode(summary: string): string {
  const match = summary.match(/[A-Z]{2,4}\s?\d{3}/i);
  if (!match) return "UNKNOWN";
  return match[0].toUpperCase().replace(/([A-Z]+)(\d)/, "$1 $2");
}

function parseIcsEvents(raw: string, source: EventSource): ClassMeeting[] {
  const lines = unfoldIcs(raw);
  const events: ClassMeeting[] = [];
  let inEvent = false;
  let summary = "";
  let location = "";
  let start = "";
  let end = "";

  const flush = () => {
    if (!summary || !start) return;
    const startIso = icsDateToIso(start);
    const endIso = end
      ? icsDateToIso(end)
      : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    events.push({
      courseCode: extractCourseCode(summary),
      title: summary,
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
    const value = line.slice(splitAt + 1);
    if (key === "SUMMARY") summary = value;
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
    const title =
      trimmed.replace(isoMatch[1], "").replace(/[|@,-]+/g, " ").trim() ||
      "Untitled";
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) continue;
    events.push({
      courseCode: extractCourseCode(title),
      title,
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

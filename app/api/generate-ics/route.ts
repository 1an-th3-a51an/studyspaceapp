export const maxDuration = 60;

type IcsEventInput = {
  summary?: unknown;
  dtstart?: unknown;
};

const CRLF = "\r\n";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIcsUtc(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// RFC 5545 §3.3.11 TEXT escaping.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space.
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, "utf8");
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + chBytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current) parts.push(current);
  return parts.join(`${CRLF} `);
}

export async function POST(request: Request): Promise<Response> {
  let body: { events?: unknown };
  try {
    body = (await request.json()) as { events?: unknown };
  } catch {
    body = {};
  }

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return Response.json({ error: "events required" }, { status: 400 });
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudySpace//EN",
  ];

  for (const raw of events as IcsEventInput[]) {
    const summary = typeof raw?.summary === "string" ? raw.summary.trim() : "";
    const dtstart = typeof raw?.dtstart === "string" ? toIcsUtc(raw.dtstart) : null;
    if (!summary || !dtstart) {
      return Response.json(
        { error: "each event needs a summary and an ISO 8601 dtstart" },
        { status: 400 },
      );
    }
    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTART:${dtstart}`);
    lines.push(foldLine(`SUMMARY:${escapeText(summary)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join(CRLF) + CRLF, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="studyspace.ics"',
    },
  });
}

import type { ParsedSyllabus } from "@/lib/types";

export const maxDuration = 60;

const DEMO_DELAY_MS = 800;
// Keep the provider call well under Vercel's 60s ceiling.
const OPENAI_TIMEOUT_MS = 45_000;
const COURSE_CODE_RE = /[A-Z]{2,4}\s?\d{3}/;

const DEMO_SYLLABUS: ParsedSyllabus = {
  courseCode: "CPSC 223",
  title: "Data Structures and Programming Techniques",
  meetings: [
    {
      courseCode: "CPSC 223",
      title: "Lecture",
      location: "Davies Auditorium",
      start: "2026-09-14T10:30:00-04:00",
      end: "2026-09-14T11:45:00-04:00",
      source: "demo",
    },
  ],
  officeHours: [
    {
      start: "2026-09-16T14:00:00-04:00",
      end: "2026-09-16T16:00:00-04:00",
      location: "AKW 000",
    },
  ],
  deadlines: [
    {
      courseCode: "CPSC 223",
      title: "Problem Set 1",
      due: "2026-09-18T23:59:00-04:00",
      source: "demo",
    },
  ],
};

type ParseRequest = {
  text?: unknown;
  isDemo?: unknown;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function deterministicFallback(text: string): ParsedSyllabus {
  const codeMatch = text.match(COURSE_CODE_RE);
  const firstLine =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  return {
    courseCode: codeMatch ? codeMatch[0] : "UNKNOWN",
    title: firstLine,
    meetings: [],
    officeHours: [],
    deadlines: [],
  };
}

function isIsoString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeLlmOutput(raw: unknown, fallback: ParsedSyllabus): ParsedSyllabus {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const courseCode =
    typeof obj.courseCode === "string" && obj.courseCode.trim()
      ? obj.courseCode.trim()
      : fallback.courseCode;
  const title =
    typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : fallback.title;

  const meetings: ParsedSyllabus["meetings"] = [];
  if (Array.isArray(obj.meetings)) {
    for (const m of obj.meetings as Record<string, unknown>[]) {
      if (!m || !isIsoString(m.start) || !isIsoString(m.end)) continue;
      meetings.push({
        courseCode: typeof m.courseCode === "string" ? m.courseCode : courseCode,
        title: typeof m.title === "string" ? m.title : "Meeting",
        location: typeof m.location === "string" ? m.location : undefined,
        start: m.start,
        end: m.end,
        source: "syllabus",
      });
    }
  }

  const officeHours: ParsedSyllabus["officeHours"] = [];
  if (Array.isArray(obj.officeHours)) {
    for (const o of obj.officeHours as Record<string, unknown>[]) {
      if (!o || !isIsoString(o.start) || !isIsoString(o.end)) continue;
      officeHours.push({
        start: o.start,
        end: o.end,
        location: typeof o.location === "string" ? o.location : undefined,
      });
    }
  }

  const deadlines: ParsedSyllabus["deadlines"] = [];
  if (Array.isArray(obj.deadlines)) {
    for (const d of obj.deadlines as Record<string, unknown>[]) {
      if (!d || !isIsoString(d.due)) continue;
      deadlines.push({
        courseCode: typeof d.courseCode === "string" ? d.courseCode : courseCode,
        title: typeof d.title === "string" ? d.title : "Deadline",
        due: d.due,
        source: "syllabus",
      });
    }
  }

  return { courseCode, title, meetings, officeHours, deadlines };
}

async function parseWithOpenAi(text: string, apiKey: string): Promise<ParsedSyllabus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract structured data from a university course syllabus. " +
              "Return ONLY a JSON object with keys: courseCode (string like \"CPSC 223\"), " +
              "title (string), meetings (array of {courseCode, title, location?, start, end}), " +
              "officeHours (array of {start, end, location?}), deadlines (array of {courseCode, title, due}). " +
              "All start/end/due values must be ISO 8601 strings with a timezone offset. " +
              "Assume America/New_York when the syllabus gives no timezone. " +
              "If a value is unknown, omit the item rather than guessing.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("openai empty response");
    return normalizeLlmOutput(JSON.parse(content), deterministicFallback(text));
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: ParseRequest;
  try {
    body = (await request.json()) as ParseRequest;
  } catch {
    body = {};
  }

  if (body.isDemo === true) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
    return json(DEMO_SYLLABUS);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return json({ error: "text required when isDemo is false" }, 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(deterministicFallback(text));
  }

  try {
    return json(await parseWithOpenAi(text, apiKey));
  } catch {
    return json({ error: "syllabus parse failed" }, 502);
  }
}

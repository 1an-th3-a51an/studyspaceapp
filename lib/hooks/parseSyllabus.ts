import type { ParsedSyllabus } from "@/lib/types";

export async function parseSyllabus(body: {
  text?: string;
  isDemo?: boolean;
}): Promise<ParsedSyllabus> {
  const res = await fetch("/api/parse-syllabus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `Parse syllabus failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }

  return (await res.json()) as ParsedSyllabus;
}

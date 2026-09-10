import type { GenerateIcsEvent } from "@/lib/types";

export async function generateIcs(events: GenerateIcsEvent[]): Promise<Blob> {
  const res = await fetch("/api/generate-ics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });

  if (res.status === 404) {
    throw new Error("Calendar export API not deployed yet");
  }

  if (!res.ok) {
    let message = `Generate ICS failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res.blob();
}

export async function downloadGeneratedIcs(
  events: GenerateIcsEvent[],
): Promise<void> {
  const blob = await generateIcs(events);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "studyspace.ics";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

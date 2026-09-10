export async function seedDb(): Promise<unknown> {
  const res = await fetch("/api/seed-db", { method: "GET" });

  if (!res.ok) {
    let message = `Seed DB failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }

  return res.json();
}

import { apiFetch } from "@/lib/hooks/apiFetch";
import { ensureDeviceId } from "@/lib/identity";

export type SubscribeResult = {
  courses: string[];
  email: string;
  /** False when the server has no mail provider and will only log sends. */
  mailConfigured: boolean;
};

async function readError(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    /* fall through */
  }
  return `Subscribe API failed (${res.status})`;
}

export async function subscribeToCourses(input: {
  email: string;
  courseCodes: string[];
  displayName?: string;
}): Promise<SubscribeResult> {
  const res = await apiFetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "subscribe",
      deviceId: ensureDeviceId(),
      ...input,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SubscribeResult;
}

export async function unsubscribeEmail(email: string): Promise<{ removed: number }> {
  const res = await apiFetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "unsubscribe",
      deviceId: ensureDeviceId(),
      email,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { removed: number };
}

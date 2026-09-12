"use client";

import { currentIdToken } from "@/lib/firebase/client";

/** fetch() that attaches the Firebase ID token when someone is signed in. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

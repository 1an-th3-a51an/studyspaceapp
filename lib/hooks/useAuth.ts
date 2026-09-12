"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { completeRedirectSignIn, signInWithYale, signOutYale, watchAuth } from "@/lib/firebase/client";
import { isWebAuthConfigured } from "@/lib/firebase/webConfig";
import { getDisplayName, setDisplayName, setNotifyEmail } from "@/lib/identity";

export type AuthUser = {
  uid: string;
  email: string;
  name: string;
  photoUrl: string | null;
};

export const AUTH_CHANGED_EVENT = "studyspace:auth";

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? "",
    name: user.displayName ?? user.email?.split("@")[0] ?? "Yale student",
    photoUrl: user.photoURL ?? null,
  };
}

/**
 * Google sign-in state. When someone signs in, their Google name becomes the
 * display name (unless they already chose one) and their Yale email becomes
 * the announcement address, so the rest of the app needs no changes.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = isWebAuthConfigured();

  useEffect(() => {
    void completeRedirectSignIn().catch(() => undefined);
    const unsubscribe = watchAuth((u) => {
      const next = u ? toAuthUser(u) : null;
      setUser(next);
      setReady(true);
      if (next) {
        if (!getDisplayName()) setDisplayName(next.name);
        if (next.email) setNotifyEmail(next.email);
      }
      window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: next }));
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithYale();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await signOutYale();
    } finally {
      setBusy(false);
    }
  }, []);

  return { user, ready, busy, error, configured, signIn, signOut };
}

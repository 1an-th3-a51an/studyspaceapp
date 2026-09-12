"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { ALLOWED_EMAIL_DOMAIN, FIREBASE_WEB_CONFIG, isWebAuthConfigured } from "@/lib/firebase/webConfig";

/**
 * Browser-side Firebase, used only for Google sign-in with Yale accounts.
 * Firestore is never touched from the browser; all data goes through the
 * app's API routes, which verify the ID token server-side.
 */

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getWebAuth(): Auth | null {
  if (typeof window === "undefined" || !isWebAuthConfigured()) return null;
  if (!app) app = getApps().length ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  if (!auth) auth = getAuth(app);
  return auth;
}

export class NotYaleAccountError extends Error {
  constructor(email: string) {
    super(`${email} is not a ${ALLOWED_EMAIL_DOMAIN} account. Sign in with your Yale Google account.`);
  }
}

export function isYaleEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`));
}

function yaleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // `hd` pre-filters the account chooser; the email check is the real gate.
  provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" });
  return provider;
}

async function enforceYale(a: Auth, user: User): Promise<User> {
  if (!isYaleEmail(user.email)) {
    await signOut(a);
    throw new NotYaleAccountError(user.email ?? "that account");
  }
  return user;
}

/**
 * Google sign-in restricted to the Yale Workspace domain. Uses a popup, and
 * falls back to a full-page redirect when the browser blocks popups.
 */
export async function signInWithYale(): Promise<User | null> {
  const a = getWebAuth();
  if (!a) throw new Error("Google sign-in is not configured on this deployment.");
  const provider = yaleProvider();
  try {
    const result = await signInWithPopup(a, provider);
    return enforceYale(a, result.user);
  } catch (caught) {
    const code = (caught as { code?: string })?.code ?? "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(a, provider);
      return null; // page navigates away; result is picked up on return
    }
    throw caught;
  }
}

/** Complete a redirect sign-in after the page returns from Google. */
export async function completeRedirectSignIn(): Promise<User | null> {
  const a = getWebAuth();
  if (!a) return null;
  try {
    const result = await getRedirectResult(a);
    return result ? enforceYale(a, result.user) : null;
  } catch {
    return null;
  }
}

export async function signOutYale(): Promise<void> {
  const a = getWebAuth();
  if (a) await signOut(a);
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  const a = getWebAuth();
  if (!a) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(a, cb);
}

/** Fresh ID token for API calls, or null when signed out / unconfigured. */
export async function currentIdToken(): Promise<string | null> {
  const a = getWebAuth();
  const user = a?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

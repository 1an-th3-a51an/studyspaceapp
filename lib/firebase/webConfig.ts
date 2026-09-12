/**
 * Public Firebase web configuration for the client SDK (Auth only).
 *
 * Supplied through NEXT_PUBLIC_FIREBASE_* env vars in .env.local (see
 * .env.example). Nothing is committed here on purpose: even though Firebase
 * web keys are designed to ship in browser bundles, the team asked that they
 * never appear in the public repo.
 */
export const FIREBASE_WEB_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "studyspace-2fc29.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "studyspace-2fc29",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Only accounts on this Google Workspace domain may sign in. */
export const ALLOWED_EMAIL_DOMAIN = "yale.edu";

export function isWebAuthConfigured(): boolean {
  return Boolean(FIREBASE_WEB_CONFIG.apiKey && FIREBASE_WEB_CONFIG.appId);
}

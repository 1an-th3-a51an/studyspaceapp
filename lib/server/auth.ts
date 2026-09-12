import { getAdminApp, getFirestoreDb } from "@/lib/firebase/admin";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/firebase/webConfig";

/**
 * Optional Google identity for API requests.
 *
 * Clients may send `Authorization: Bearer <Firebase ID token>`. When the token
 * verifies and belongs to a yale.edu account, the request acts as that user's
 * uid instead of the anonymous deviceId, so pools, bookings, and invites
 * follow the person across laptops and phones. Without a token, nothing
 * changes: the deviceId model keeps working.
 *
 * firebase-admin/auth is loaded lazily: a top-level import of that path
 * crashes the Vercel function at module load (empty 500) even when nobody
 * is signed in.
 */
export type Actor = {
  /** The identity key used by the store: uid when signed in, else deviceId. */
  deviceId: string;
  email?: string;
  name?: string;
  signedIn: boolean;
};

export async function resolveActor(request: Request, deviceId: string): Promise<Actor> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { deviceId, signedIn: false };
  // Admin app is initialised by the Firestore getter; no Firestore means no Auth.
  if (!getFirestoreDb()) return { deviceId, signedIn: false };
  const adminApp = getAdminApp();
  if (!adminApp) return { deviceId, signedIn: false };
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email || !email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`) || !decoded.email_verified) {
      return { deviceId, signedIn: false };
    }
    return {
      deviceId: `uid:${decoded.uid}`,
      email,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
      signedIn: true,
    };
  } catch {
    return { deviceId, signedIn: false };
  }
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-only Firestore. Identity stays a local deviceId — no Auth, no OAuth.
 *
 * Configure with any one of:
 *   FIREBASE_SERVICE_ACCOUNT_FILE  path to a downloaded service-account JSON
 *                                  (default: ./firebase-service-account.json,
 *                                  which is gitignored — just drop it there)
 *   FIREBASE_SERVICE_ACCOUNT       JSON string of a service-account key
 * or the split vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY           (newlines as \n)
 */
const DEFAULT_KEY_FILE = "firebase-service-account.json";

function keyFilePath(): string {
  return resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim() || DEFAULT_KEY_FILE);
}

function readKeyFile(): string {
  try {
    const path = keyFilePath();
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  } catch {
    return "";
  }
}

export function isFirebaseConfigured(): boolean {
  if (readKeyFile().trim()) return true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT?.trim()) return true;
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
      process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
      process.env.FIREBASE_PRIVATE_KEY?.trim(),
  );
}

function serviceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const raw = readKeyFile().trim() || process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      return null;
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

let app: App | undefined;
let db: Firestore | undefined;

export function getAdminApp(): App | null {
  if (app) return app;
  if (!isFirebaseConfigured()) return null;
  const account = serviceAccount();
  if (!account) return null;
  try {
    app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: account.projectId,
          clientEmail: account.clientEmail,
          privateKey: account.privateKey,
        }),
        projectId: account.projectId,
      });
    return app;
  } catch (error) {
    console.error(
      "[studyspace] firebase admin init failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function getFirestoreDb(): Firestore | null {
  if (db) return db;
  const adminApp = getAdminApp();
  if (!adminApp) return null;
  db = getFirestore(adminApp);
  // Optional fields (e.g. notified.detail) are legitimately undefined; drop them
  // instead of failing the whole write. settings() throws if this isolate already
  // configured the same Firestore instance (common on Vercel with shared apps).
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* already initialized */
  }
  return db;
}

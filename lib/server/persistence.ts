import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Durable storage for the in-process store.
 *
 * Firestore is the right backend for a multi-instance deployment, but needing
 * a service account before pools survive a restart made local development feel
 * broken. So the default backend now writes a small JSON snapshot to disk:
 * `next dev` restarts, deploys, and crashes all keep their pools.
 *
 * Candidate directories, in order: STUDYSPACE_DATA_DIR, ./.data, then the OS
 * temp dir. If none is writable we fall back to memory and say so, rather than
 * throwing on the first request.
 */
export type PersistenceKind = "file" | "memory";

export type Persistence<T> = {
  kind: PersistenceKind;
  /** Human-readable location, surfaced by the API for the UI's backend chip. */
  label: string;
  load(): T | null;
  save(state: T): void;
};

const FILE_NAME = "studyspace-live.json";

function candidateDirs(): string[] {
  const dirs: string[] = [];
  if (process.env.STUDYSPACE_DATA_DIR) dirs.push(process.env.STUDYSPACE_DATA_DIR);
  // Serverless filesystems are read-only apart from the temp dir.
  if (!process.env.VERCEL) dirs.push(join(process.cwd(), ".data"));
  dirs.push(join(tmpdir(), "studyspace"));
  return dirs;
}

function openWritableDir(): string | null {
  for (const dir of candidateDirs()) {
    try {
      mkdirSync(dir, { recursive: true });
      const probe = join(dir, ".write-probe");
      writeFileSync(probe, "ok");
      return dir;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function memoryPersistence<T>(reason: string): Persistence<T> {
  let held: T | null = null;
  return {
    kind: "memory",
    label: reason,
    load: () => held,
    save: (state) => {
      held = state;
    },
  };
}

export function createPersistence<T>(): Persistence<T> {
  if (process.env.STUDYSPACE_PERSISTENCE === "memory") {
    return memoryPersistence<T>("in-memory (STUDYSPACE_PERSISTENCE=memory)");
  }

  const dir = openWritableDir();
  if (!dir) return memoryPersistence<T>("in-memory (no writable data directory)");

  const file = join(dir, FILE_NAME);
  const temp = `${file}.tmp`;
  let broken = false;

  return {
    kind: "file",
    label: file,
    load() {
      try {
        return JSON.parse(readFileSync(file, "utf8")) as T;
      } catch {
        // Missing or corrupt snapshot: start clean rather than refuse to boot.
        return null;
      }
    },
    save(state) {
      if (broken) return;
      try {
        // Write-then-rename so a crash mid-write cannot truncate the snapshot.
        writeFileSync(temp, JSON.stringify(state), "utf8");
        renameSync(temp, file);
      } catch (error) {
        broken = true;
        console.warn(
          `[studyspace] disabling snapshot writes to ${file}:`,
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
}

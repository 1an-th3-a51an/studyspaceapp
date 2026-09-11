import { DEMO_POOLS } from "@/lib/demo/handsomeDan";
import * as firebasePools from "@/lib/firebase/pools";
import {
  ensureDeviceId,
  readJson,
  STORAGE_KEYS,
  writeJson,
} from "@/lib/identity";
import type { StudyPool } from "@/lib/types";

function isNotWired(error: unknown): boolean {
  return error instanceof Error && error.message === "Seed DB not wired";
}

function mergeById(groups: StudyPool[][]): StudyPool[] {
  const byId = new Map<string, StudyPool>();
  for (const group of groups) {
    for (const pool of group) byId.set(pool.id, pool);
  }
  return Array.from(byId.values());
}

export async function listPoolsByCourseCode(courseCode: string): Promise<{
  pools: StudyPool[];
  wired: boolean;
}> {
  const local = readJson<StudyPool[]>(STORAGE_KEYS.localPools, []).filter(
    (pool) => pool.courseCode.toUpperCase() === courseCode.toUpperCase(),
  );
  const demo = DEMO_POOLS.filter(
    (pool) => pool.courseCode.toUpperCase() === courseCode.toUpperCase(),
  );

  try {
    const remote = await firebasePools.listPoolsByCourseCode(courseCode);
    return { pools: mergeById([demo, local, remote]), wired: true };
  } catch (error) {
    if (isNotWired(error)) {
      return { pools: mergeById([demo, local]), wired: false };
    }
    throw error;
  }
}

export async function hostPool(input: {
  courseCode: string;
  hostDisplayName: string;
  targetGroupSize: 1 | 2 | 3 | 4;
}): Promise<{ pool: StudyPool; wired: boolean }> {
  const deviceId = ensureDeviceId();
  try {
    const pool = await firebasePools.hostPool({ deviceId, ...input });
    return { pool, wired: true };
  } catch (error) {
    if (!isNotWired(error)) throw error;
    const pool: StudyPool = {
      id: crypto.randomUUID(),
      courseCode: input.courseCode,
      hostDisplayName: input.hostDisplayName,
      targetGroupSize: input.targetGroupSize,
      memberCount: 1,
      isDemoSample: false,
      createdAt: new Date().toISOString(),
    };
    const existing = readJson<StudyPool[]>(STORAGE_KEYS.localPools, []);
    writeJson(STORAGE_KEYS.localPools, mergeById([existing, [pool]]));
    return { pool, wired: false };
  }
}

export async function joinPool(input: {
  poolId: string;
}): Promise<{ pool: StudyPool; wired: boolean }> {
  const deviceId = ensureDeviceId();
  try {
    const pool = await firebasePools.joinPool({ deviceId, poolId: input.poolId });
    return { pool, wired: true };
  } catch (error) {
    if (!isNotWired(error)) throw error;
    const existing = readJson<StudyPool[]>(STORAGE_KEYS.localPools, []);
    const localIndex = existing.findIndex((pool) => pool.id === input.poolId);
    if (localIndex >= 0) {
      const current = existing[localIndex];
      if (current.memberCount >= current.targetGroupSize) {
        throw new Error("pool full");
      }
      const next = { ...current, memberCount: current.memberCount + 1 };
      const withoutDuplicates = existing.filter(
        (pool) => pool.id !== input.poolId,
      );
      writeJson(
        STORAGE_KEYS.localPools,
        mergeById([withoutDuplicates, [next]]),
      );
      return { pool: next, wired: false };
    }
    const demo = DEMO_POOLS.find((pool) => pool.id === input.poolId);
    if (!demo) throw new Error("pool not found");
    if (demo.memberCount >= demo.targetGroupSize) {
      throw new Error("pool full");
    }
    const joined = { ...demo, memberCount: demo.memberCount + 1, isDemoSample: true };
    writeJson(STORAGE_KEYS.localPools, mergeById([existing, [joined]]));
    return { pool: joined, wired: false };
  }
}

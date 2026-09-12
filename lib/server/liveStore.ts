import { FieldValue, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { similarCourses, normalizeCourseCode } from "@/lib/courseSimilarity";
import { DEMO_POOLS } from "@/lib/demo/handsomeDan";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { failsProfanityCheck } from "@/lib/profanity";
import { bookingAudience, notifyBooking } from "@/lib/server/bookingNotify";
import { isEmailish } from "@/lib/server/mailer";
import { createPersistence } from "@/lib/server/persistence";
import { resolveBookingCapacity } from "@/lib/spots";
import type {
  BackendInfo,
  CourseSubscription,
  PrivatePool,
  PrivatePoolReason,
  QueueEntry,
  QueueSnapshot,
  RoomBooking,
  StudyPool,
} from "@/lib/types";

export const STALE_MS = 45_000;
export const BOOKING_TTL_MS = 6 * 60 * 60 * 1000;
export const HOST_POOL_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_NAME = 40;

const COL_POOLS = "study_pools";
const COL_QUEUE = "queue_entries";
const COL_BOOKINGS = "room_bookings";
const COL_SUBSCRIPTIONS = "course_subscriptions";
const COL_PRIVATE = "private_pools";

/** Private pools expire this long after their start (or creation, if no start). */
export const PRIVATE_POOL_TTL_MS = 6 * 60 * 60 * 1000;
export const PRIVATE_POOL_NO_START_TTL_MS = 48 * 60 * 60 * 1000;

export function normalizeNetId(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 32) : "";
}

export function privatePoolExpiry(input: { start?: string; createdAt: string }): string {
  const startMs = input.start ? Date.parse(input.start) : NaN;
  const base = Number.isNaN(startMs)
    ? Date.parse(input.createdAt) + PRIVATE_POOL_NO_START_TTL_MS
    : startMs + PRIVATE_POOL_TTL_MS;
  return new Date(base).toISOString();
}

/** A private pool is visible to its host, its members, and anyone invited (by NetID or Yale email). */
function canSeePrivatePool(pool: PrivatePool, deviceId: string, netId: string, email?: string): boolean {
  if (pool.hostDeviceId === deviceId) return true;
  if (pool.members.some((m) => m.deviceId === deviceId)) return true;
  if (netId && pool.inviteeNetIds.includes(netId)) return true;
  return Boolean(email) && pool.inviteeNetIds.includes(email!.toLowerCase());
}

function isInvited(pool: PrivatePool, netId: string, email?: string): boolean {
  return pool.inviteeNetIds.includes(netId) || (Boolean(email) && pool.inviteeNetIds.includes(email!.toLowerCase()));
}

export type PoolOrigin = "demo" | "host" | "queue";

export type PoolRecord = StudyPool & {
  memberDeviceIds: string[];
  origin: PoolOrigin;
};

export type { BackendInfo };

function poolTtlMs(): number {
  const raw = Number(process.env.POOL_TTL_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 15;
  return minutes * 60 * 1000;
}

export function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME) : "";
}

export function assertDisplayName(name: string): string {
  const cleaned = cleanName(name);
  if (!cleaned) throw new HttpError(400, "displayName required");
  if (failsProfanityCheck(cleaned)) {
    throw new HttpError(400, "displayName failed the 5-word check");
  }
  return cleaned;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function publicPool(record: PoolRecord): StudyPool {
  const { memberDeviceIds: _ids, origin: _origin, ...pool } = record;
  void _ids;
  void _origin;
  return pool;
}

function isPoolLive(record: PoolRecord, now: number): boolean {
  const age = now - Date.parse(record.createdAt);
  if (record.origin === "demo" || record.isDemoSample) return true;
  if (record.origin === "host") return age < HOST_POOL_TTL_MS;
  return age < poolTtlMs();
}

function tryMatchWaiting(waiting: QueueEntry[], now: number): {
  pool: PoolRecord;
  memberIds: string[];
} | null {
  const unmatched = waiting
    .filter((e) => !e.poolId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  if (unmatched.length < 2) return null;
  const size = Math.min(...unmatched.map((e) => e.targetGroupSize));
  if (unmatched.length < size) return null;
  const members = unmatched.slice(0, size);
  const nowIso = new Date(now).toISOString();
  const pool: PoolRecord = {
    id: crypto.randomUUID(),
    courseCode: members[0].courseCode,
    hostDisplayName: members[0].displayName,
    targetGroupSize: Math.min(4, Math.max(1, size)) as 1 | 2 | 3 | 4,
    memberCount: size,
    isDemoSample: false,
    createdAt: nowIso,
    memberDeviceIds: members.map((m) => m.deviceId),
    origin: "queue",
  };
  return { pool, memberIds: members.map((m) => m.id) };
}

function buildSnapshot(input: {
  courseCode: string;
  deviceId: string;
  now: number;
  queue: QueueEntry[];
  pools: StudyPool[];
  bookings: RoomBooking[];
}): QueueSnapshot {
  const similar = similarCourses(input.courseCode);
  const similarByCode = new Map(similar.map((c) => [c.courseCode, c.label]));
  const queue = input.queue.filter((e) => e.courseCode === input.courseCode);
  return {
    serverTime: new Date(input.now).toISOString(),
    courseCode: input.courseCode,
    similarCourses: similar.map((c) => ({ courseCode: c.courseCode, label: c.label })),
    queue,
    myEntry: queue.find((e) => e.deviceId === input.deviceId) ?? null,
    pools: input.pools.filter((p) => p.courseCode === input.courseCode),
    bookings: input.bookings
      .filter((b) => b.courseCode === input.courseCode || similarByCode.has(b.courseCode))
      .map((b) => ({
        ...b,
        via: b.courseCode === input.courseCode ? undefined : similarByCode.get(b.courseCode),
      }))
      .sort((a, b) => a.start.localeCompare(b.start)),
  };
}

export type LiveStore = {
  backend: BackendInfo;
  gc(now: number): Promise<void>;
  heartbeat(courseCode: string, deviceId: string, now: number): Promise<void>;
  snapshot(courseCode: string, deviceId: string, now: number): Promise<QueueSnapshot>;
  joinQueue(input: {
    deviceId: string;
    displayName: string;
    courseCode: string;
    targetGroupSize: number;
    now: number;
  }): Promise<QueueSnapshot & { matched: StudyPool | null }>;
  leaveQueue(input: {
    deviceId: string;
    courseCode: string;
    now: number;
  }): Promise<QueueSnapshot>;
  book(input: {
    deviceId: string;
    displayName: string;
    courseCode: string;
    spotName: string;
    bookingUrl?: string;
    start: string;
    capacity: number;
    now: number;
    hostEmail?: string;
  }): Promise<QueueSnapshot & { booking: RoomBooking }>;
  joinBooking(input: {
    deviceId: string;
    displayName: string;
    bookingId: string;
    courseCode: string;
    now: number;
  }): Promise<QueueSnapshot & { booking: RoomBooking }>;
  listPools(courseCode: string, now: number): Promise<StudyPool[]>;
  hostPool(input: {
    deviceId: string;
    courseCode: string;
    hostDisplayName: string;
    targetGroupSize: 1 | 2 | 3 | 4;
    now: number;
  }): Promise<StudyPool>;
  joinPool(input: { deviceId: string; poolId: string; now: number }): Promise<StudyPool>;
  /** Opt an address in to booking announcements for a set of courses. */
  subscribe(input: {
    deviceId: string;
    email: string;
    displayName?: string;
    courseCodes: string[];
    now: number;
  }): Promise<{ courses: string[] }>;
  unsubscribe(input: { email: string }): Promise<{ removed: number }>;
  seedDemoPools(now: number): Promise<{ written: number; backend: BackendInfo["kind"] }>;
  /** Host removes their own booking announcement (releasing the room). */
  releaseBooking(input: {
    deviceId: string;
    bookingId: string;
    courseCode: string;
    now: number;
  }): Promise<QueueSnapshot & { released: boolean }>;
  /** Invite-only pools visible to this device / NetID. */
  listPrivatePools(input: { deviceId: string; netId: string; email?: string; now: number }): Promise<PrivatePool[]>;
  createPrivatePool(input: {
    deviceId: string;
    displayName: string;
    netId: string;
    inviteeNetIds: string[];
    reason: PrivatePoolReason;
    note?: string;
    courseCode?: string;
    spotName?: string;
    bookingUrl?: string;
    start?: string;
    now: number;
  }): Promise<PrivatePool>;
  respondPrivatePool(input: {
    deviceId: string;
    displayName: string;
    netId: string;
    email?: string;
    poolId: string;
    accept: boolean;
    now: number;
  }): Promise<PrivatePool>;
  cancelPrivatePool(input: { deviceId: string; poolId: string; now: number }): Promise<{ removed: boolean }>;
};

type LocalState = {
  queue: QueueEntry[];
  bookings: RoomBooking[];
  pools: PoolRecord[];
  subscriptions: CourseSubscription[];
  privatePools: PrivatePool[];
};

/**
 * Coerce anything claiming to be a LocalState into one.
 *
 * The state can arrive from three places that are all outside this version's
 * control: a JSON snapshot written by an older build, a `globalThis` object
 * left behind by a hot reload, or nothing at all. Missing collections are
 * normal during an upgrade, so they are filled in rather than trusted.
 */
function normaliseState(input: Partial<LocalState> | null | undefined): LocalState {
  const arrayOr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    queue: arrayOr<QueueEntry>(input?.queue),
    bookings: arrayOr<RoomBooking>(input?.bookings),
    pools: arrayOr<PoolRecord>(input?.pools),
    subscriptions: arrayOr<CourseSubscription>(input?.subscriptions),
    privatePools: arrayOr<PrivatePool>(input?.privatePools),
  };
}

/**
 * Single-process fallback used only when Firebase credentials are missing.
 * Two devices cannot share this store — configure Firestore for that.
 */
function createLocalStore(): LiveStore {
  const persistence = createPersistence<Partial<LocalState>>();
  const g = globalThis as unknown as { __studyspaceLive?: Partial<LocalState> };

  function isComplete(value: Partial<LocalState> | undefined): value is LocalState {
    return (
      !!value &&
      Array.isArray(value.queue) &&
      Array.isArray(value.bookings) &&
      Array.isArray(value.pools) &&
      Array.isArray(value.subscriptions) &&
      Array.isArray(value.privatePools)
    );
  }

  function state(): LocalState {
    const held = g.__studyspaceLive;
    if (isComplete(held)) return held;
    const normalised = normaliseState(held ?? persistence.load());
    g.__studyspaceLive = normalised;
    return normalised;
  }

  function flush() {
    persistence.save(state());
  }

  const backend: BackendInfo =
    persistence.kind === "file"
      ? {
          kind: "file",
          label: "local file",
          durable: true,
          detail: `Pools, queue, and bookings persist to ${persistence.label}.`,
        }
      : {
          kind: "memory",
          label: "in-memory",
          durable: false,
          detail: `No writable data directory (${persistence.label}), so state is lost on restart.`,
        };

  const gc = async (now: number) => {
    const s = state();
    const before =
      s.pools.length + s.queue.length + s.bookings.length;
    s.pools = s.pools.filter((p) => isPoolLive(p, now));
    const livePoolIds = new Set(s.pools.map((p) => p.id));
    s.queue = s.queue.filter((e) =>
      e.poolId ? livePoolIds.has(e.poolId) : now - Date.parse(e.lastSeenAt) < STALE_MS,
    );
    s.bookings = s.bookings.filter((b) => now - Date.parse(b.start) < BOOKING_TTL_MS);
    const privateBefore = s.privatePools.length;
    s.privatePools = s.privatePools.filter((p) => Date.parse(p.expiresAt) > now);
    if (
      before !== s.pools.length + s.queue.length + s.bookings.length ||
      privateBefore !== s.privatePools.length
    ) {
      flush();
    }
  };

  const snapshot = async (courseCode: string, deviceId: string, now: number) => {
    const s = state();
    const similar = similarCourses(courseCode).map((c) => c.courseCode);
    return buildSnapshot({
      courseCode,
      deviceId,
      now,
      queue: s.queue,
      pools: s.pools.filter((p) => isPoolLive(p, now)).map(publicPool),
      bookings: s.bookings.filter(
        (b) => b.courseCode === courseCode || similar.includes(b.courseCode),
      ),
    });
  };

  return {
    backend,
    gc,
    async heartbeat(courseCode, deviceId, now) {
      const mine = state().queue.find(
        (e) => e.deviceId === deviceId && e.courseCode === courseCode && !e.poolId,
      );
      if (mine) {
        mine.lastSeenAt = new Date(now).toISOString();
        flush();
      }
    },
    snapshot,
    async joinQueue({ deviceId, displayName, courseCode, targetGroupSize, now }) {
      const s = state();
      s.queue = s.queue.filter(
        (e) => !(e.deviceId === deviceId && e.courseCode === courseCode && !e.poolId),
      );
      const nowIso = new Date(now).toISOString();
      s.queue.push({
        id: crypto.randomUUID(),
        deviceId,
        displayName,
        courseCode,
        targetGroupSize,
        joinedAt: nowIso,
        lastSeenAt: nowIso,
      });
      const matched = tryMatchWaiting(
        s.queue.filter((e) => e.courseCode === courseCode),
        now,
      );
      let matchedPublic: StudyPool | null = null;
      if (matched) {
        s.pools.unshift(matched.pool);
        for (const e of s.queue) {
          if (matched.memberIds.includes(e.id)) e.poolId = matched.pool.id;
        }
        matchedPublic = publicPool(matched.pool);
      }
      flush();
      return { ...(await snapshot(courseCode, deviceId, now)), matched: matchedPublic };
    },
    async leaveQueue({ deviceId, courseCode, now }) {
      const s = state();
      s.queue = s.queue.filter(
        (e) => !(e.deviceId === deviceId && e.courseCode === courseCode && !e.poolId),
      );
      flush();
      return snapshot(courseCode, deviceId, now);
    },
    async book({ deviceId, displayName, courseCode, spotName, bookingUrl, start, capacity, now, hostEmail }) {
      const ruling = resolveBookingCapacity(spotName, capacity);
      const booking: RoomBooking = {
        id: crypto.randomUUID(),
        deviceId,
        hostDisplayName: displayName,
        courseCode,
        spotName,
        bookingUrl,
        start,
        capacity: ruling.capacity,
        capacityNote: ruling.note,
        members: [{ deviceId, displayName }],
        createdAt: new Date(now).toISOString(),
      };
      const s = state();
      booking.notified = await notifyBooking(booking, s.subscriptions, { hostEmail });
      s.bookings.unshift(booking);
      flush();
      return { ...(await snapshot(courseCode, deviceId, now)), booking };
    },
    async joinBooking({ deviceId, displayName, bookingId, courseCode, now }) {
      const booking = state().bookings.find((b) => b.id === bookingId);
      if (!booking) throw new HttpError(404, "booking not found");
      if (!booking.members.some((m) => m.deviceId === deviceId)) {
        if (booking.members.length >= booking.capacity) {
          throw new HttpError(409, "booking full");
        }
        booking.members.push({ deviceId, displayName });
        flush();
      }
      const code = normalizeCourseCode(courseCode || booking.courseCode);
      return { ...(await snapshot(code, deviceId, now)), booking };
    },
    async listPools(courseCode, now) {
      return state().pools
        .filter((p) => isPoolLive(p, now) && p.courseCode === courseCode)
        .map(publicPool);
    },
    async hostPool({ deviceId, courseCode, hostDisplayName, targetGroupSize, now }) {
      const pool: PoolRecord = {
        id: crypto.randomUUID(),
        courseCode,
        hostDisplayName,
        targetGroupSize,
        memberCount: 1,
        isDemoSample: false,
        createdAt: new Date(now).toISOString(),
        memberDeviceIds: [deviceId],
        origin: "host",
      };
      state().pools.unshift(pool);
      flush();
      return publicPool(pool);
    },
    async joinPool({ deviceId, poolId, now }) {
      const s = state();
      const pools = s.pools;
      const found = pools.find((p) => p.id === poolId);
      if (!found || !isPoolLive(found, now)) throw new HttpError(404, "pool not found");
      if (!found.memberDeviceIds.includes(deviceId)) {
        if (found.memberCount >= found.targetGroupSize) {
          throw new HttpError(409, "pool full");
        }
        found.memberDeviceIds.push(deviceId);
        found.memberCount += 1;
      }
      if (!s.pools.some((p) => p.id === found.id)) s.pools.unshift(found);
      flush();
      return publicPool(found);
    },
    async subscribe({ deviceId, email, displayName, courseCodes, now }) {
      const s = state();
      const address = email.trim().toLowerCase();
      const createdAt = new Date(now).toISOString();
      const wanted = Array.from(new Set(courseCodes));
      // One row per (course, address); re-subscribing is a no-op.
      s.subscriptions = s.subscriptions.filter(
        (sub) => !(sub.email === address && !wanted.includes(sub.courseCode)),
      );
      for (const courseCode of wanted) {
        if (s.subscriptions.some((sub) => sub.email === address && sub.courseCode === courseCode)) {
          continue;
        }
        s.subscriptions.push({ courseCode, email: address, deviceId, displayName, createdAt });
      }
      flush();
      return { courses: wanted };
    },
    async unsubscribe({ email }) {
      const s = state();
      const address = email.trim().toLowerCase();
      const before = s.subscriptions.length;
      s.subscriptions = s.subscriptions.filter((sub) => sub.email !== address);
      flush();
      return { removed: before - s.subscriptions.length };
    },
    async seedDemoPools() {
      const s = state();
      let written = 0;
      for (const demo of DEMO_POOLS) {
        if (!s.pools.some((p) => p.id === demo.id)) {
          s.pools.push({ ...demo, memberDeviceIds: [], origin: "demo" });
          written += 1;
        }
      }
      if (written) flush();
      return { written, backend: backend.kind };
    },
    async releaseBooking({ deviceId, bookingId, courseCode, now }) {
      const s = state();
      const found = s.bookings.find((b) => b.id === bookingId);
      if (!found) throw new HttpError(404, "booking not found");
      if (found.deviceId !== deviceId) throw new HttpError(403, "only the host can release");
      s.bookings = s.bookings.filter((b) => b.id !== bookingId);
      flush();
      const code = normalizeCourseCode(courseCode || found.courseCode);
      return { ...(await snapshot(code, deviceId, now)), released: true };
    },
    async listPrivatePools({ deviceId, netId, email, now }) {
      return state().privatePools
        .filter((p) => Date.parse(p.expiresAt) > now && canSeePrivatePool(p, deviceId, netId, email))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createPrivatePool(input) {
      const createdAt = new Date(input.now).toISOString();
      const pool: PrivatePool = {
        id: crypto.randomUUID(),
        hostDeviceId: input.deviceId,
        hostDisplayName: input.displayName,
        hostNetId: input.netId,
        reason: input.reason,
        note: input.note,
        courseCode: input.courseCode,
        spotName: input.spotName,
        bookingUrl: input.bookingUrl,
        start: input.start,
        inviteeNetIds: input.inviteeNetIds,
        declinedNetIds: [],
        members: [{ deviceId: input.deviceId, displayName: input.displayName, netId: input.netId }],
        createdAt,
        expiresAt: privatePoolExpiry({ start: input.start, createdAt }),
      };
      state().privatePools.unshift(pool);
      flush();
      return pool;
    },
    async respondPrivatePool({ deviceId, displayName, netId, email, poolId, accept }) {
      const pool = state().privatePools.find((p) => p.id === poolId);
      if (!pool) throw new HttpError(404, "private pool not found");
      if (!isInvited(pool, netId, email)) throw new HttpError(403, "not invited");
      if (accept) {
        pool.declinedNetIds = pool.declinedNetIds.filter((n) => n !== netId);
        if (!pool.members.some((m) => m.deviceId === deviceId || m.netId === netId)) {
          pool.members.push({ deviceId, displayName, netId });
        }
      } else {
        pool.members = pool.members.filter((m) => m.netId !== netId && m.deviceId !== deviceId);
        if (!pool.declinedNetIds.includes(netId)) pool.declinedNetIds.push(netId);
      }
      flush();
      return pool;
    },
    async cancelPrivatePool({ deviceId, poolId }) {
      const s = state();
      const found = s.privatePools.find((p) => p.id === poolId);
      if (!found) return { removed: false };
      if (found.hostDeviceId !== deviceId) throw new HttpError(403, "only the host can cancel");
      s.privatePools = s.privatePools.filter((p) => p.id !== poolId);
      flush();
      return { removed: true };
    },
  };
}

function asPoolRecord(id: string, data: DocumentData): PoolRecord {
  return {
    id,
    courseCode: String(data.courseCode ?? ""),
    hostDisplayName: String(data.hostDisplayName ?? ""),
    targetGroupSize: Number(data.targetGroupSize) as 1 | 2 | 3 | 4,
    memberCount: Number(data.memberCount ?? 0),
    isDemoSample: Boolean(data.isDemoSample),
    createdAt: String(data.createdAt ?? ""),
    memberDeviceIds: Array.isArray(data.memberDeviceIds)
      ? data.memberDeviceIds.map(String)
      : [],
    origin: (data.origin as PoolOrigin) ?? (data.isDemoSample ? "demo" : "host"),
  };
}

function asQueueEntry(id: string, data: DocumentData): QueueEntry {
  return {
    id,
    deviceId: String(data.deviceId ?? ""),
    displayName: String(data.displayName ?? ""),
    courseCode: String(data.courseCode ?? ""),
    targetGroupSize: Number(data.targetGroupSize ?? 2),
    joinedAt: String(data.joinedAt ?? ""),
    lastSeenAt: String(data.lastSeenAt ?? ""),
    poolId: data.poolId ? String(data.poolId) : undefined,
  };
}

function asBooking(id: string, data: DocumentData): RoomBooking {
  return {
    id,
    deviceId: String(data.deviceId ?? ""),
    hostDisplayName: String(data.hostDisplayName ?? ""),
    courseCode: String(data.courseCode ?? ""),
    spotName: String(data.spotName ?? ""),
    bookingUrl: typeof data.bookingUrl === "string" ? data.bookingUrl : undefined,
    start: String(data.start ?? ""),
    capacity: Number(data.capacity ?? 1),
    capacityNote: typeof data.capacityNote === "string" ? data.capacityNote : undefined,
    members: Array.isArray(data.members)
      ? data.members.map((m: { deviceId?: string; displayName?: string }) => ({
          deviceId: String(m.deviceId ?? ""),
          displayName: String(m.displayName ?? ""),
        }))
      : [],
    createdAt: String(data.createdAt ?? ""),
  };
}

function asSubscription(data: DocumentData): CourseSubscription {
  return {
    courseCode: String(data.courseCode ?? ""),
    email: String(data.email ?? ""),
    deviceId: String(data.deviceId ?? ""),
    displayName: data.displayName ? String(data.displayName) : undefined,
    createdAt: String(data.createdAt ?? ""),
  };
}

function asPrivatePool(id: string, data: DocumentData): PrivatePool {
  const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    id,
    hostDeviceId: String(data.hostDeviceId ?? ""),
    hostDisplayName: String(data.hostDisplayName ?? ""),
    hostNetId: String(data.hostNetId ?? ""),
    reason: (data.reason as PrivatePoolReason) ?? "other",
    note: typeof data.note === "string" ? data.note : undefined,
    courseCode: typeof data.courseCode === "string" ? data.courseCode : undefined,
    spotName: typeof data.spotName === "string" ? data.spotName : undefined,
    bookingUrl: typeof data.bookingUrl === "string" ? data.bookingUrl : undefined,
    start: typeof data.start === "string" ? data.start : undefined,
    inviteeNetIds: strs(data.inviteeNetIds),
    declinedNetIds: strs(data.declinedNetIds),
    members: Array.isArray(data.members)
      ? data.members.map((m: { deviceId?: string; displayName?: string; netId?: string }) => ({
          deviceId: String(m.deviceId ?? ""),
          displayName: String(m.displayName ?? ""),
          netId: String(m.netId ?? ""),
        }))
      : [],
    createdAt: String(data.createdAt ?? ""),
    expiresAt: String(data.expiresAt ?? ""),
  };
}

/** Strip undefined so Firestore accepts the document. */
function compact(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = v;
  return out;
}

function compactDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = compactDeep(v);
    }
    return out;
  }
  return value;
}

/** Firestore document id for a subscription, so re-subscribing overwrites. */
function subscriptionDocId(courseCode: string, email: string): string {
  return `${courseCode}__${email}`.replace(/\//g, "_");
}

function createFirestoreStore(): LiveStore {
  const db = getFirestoreDb();
  if (!db) return createLocalStore();

  const backend: BackendInfo = {
    kind: "firestore",
    label: "Firestore",
    durable: true,
    detail: "Pools, queue, bookings, and subscriptions are shared across all servers.",
  };

  const gc = async (now: number) => {
    let poolSnap, queueSnap, bookingSnap, privateSnap;
    try {
      [poolSnap, queueSnap, bookingSnap, privateSnap] = await Promise.all([
        db.collection(COL_POOLS).get(),
        db.collection(COL_QUEUE).get(),
        db.collection(COL_BOOKINGS).get(),
        db.collection(COL_PRIVATE).get(),
      ]);
    } catch (error) {
      console.warn(
        "[studyspace] Firestore gc skipped",
        error instanceof Error ? error.message : error,
      );
      return;
    }
    const livePoolIds = new Set<string>();
    const batchDeletes: DocumentReference[] = [];
    for (const doc of poolSnap.docs) {
      const record = asPoolRecord(doc.id, doc.data());
      if (isPoolLive(record, now)) livePoolIds.add(doc.id);
      else batchDeletes.push(doc.ref);
    }
    for (const doc of queueSnap.docs) {
      const entry = asQueueEntry(doc.id, doc.data());
      const keep = entry.poolId
        ? livePoolIds.has(entry.poolId)
        : now - Date.parse(entry.lastSeenAt) < STALE_MS;
      if (!keep) batchDeletes.push(doc.ref);
    }
    for (const doc of bookingSnap.docs) {
      const booking = asBooking(doc.id, doc.data());
      if (now - Date.parse(booking.start) >= BOOKING_TTL_MS) batchDeletes.push(doc.ref);
    }
    for (const doc of privateSnap.docs) {
      const pool = asPrivatePool(doc.id, doc.data());
      if (!(Date.parse(pool.expiresAt) > now)) batchDeletes.push(doc.ref);
    }
    while (batchDeletes.length) {
      const chunk = batchDeletes.splice(0, 400);
      const batch = db.batch();
      for (const ref of chunk) batch.delete(ref);
      await batch.commit();
    }
  };

  const loadQueue = async (courseCode: string) => {
    const snap = await db.collection(COL_QUEUE).where("courseCode", "==", courseCode).get();
    return snap.docs.map((d) => asQueueEntry(d.id, d.data()));
  };

  const loadPools = async (courseCode: string, now: number) => {
    const snap = await db.collection(COL_POOLS).where("courseCode", "==", courseCode).get();
    const records = snap.docs.map((d) => asPoolRecord(d.id, d.data()));
    return records.filter((p) => isPoolLive(p, now));
  };

  const loadBookings = async (courseCodes: string[]) => {
    const unique = Array.from(new Set(courseCodes));
    const snaps = await Promise.all(
      unique.map((code) => db.collection(COL_BOOKINGS).where("courseCode", "==", code).get()),
    );
    return snaps.flatMap((snap) => snap.docs.map((d) => asBooking(d.id, d.data())));
  };

  const loadSubscriptions = async (courseCodes: string[]) => {
    const unique = Array.from(new Set(courseCodes));
    const snaps = await Promise.all(
      unique.map((code) =>
        db.collection(COL_SUBSCRIPTIONS).where("courseCode", "==", code).get(),
      ),
    );
    return snaps.flatMap((snap) => snap.docs.map((d) => asSubscription(d.data())));
  };

  const snapshot = async (courseCode: string, deviceId: string, now: number) => {
    const similar = similarCourses(courseCode).map((c) => c.courseCode);
    const [queue, pools, bookings] = await Promise.all([
      loadQueue(courseCode),
      loadPools(courseCode, now),
      loadBookings([courseCode, ...similar]),
    ]);
    return buildSnapshot({
      courseCode,
      deviceId,
      now,
      queue,
      pools: pools.map(publicPool),
      bookings,
    });
  };

  return {
    backend,
    gc,
    async heartbeat(courseCode, deviceId, now) {
      const snap = await db.collection(COL_QUEUE).where("deviceId", "==", deviceId).get();
      const nowIso = new Date(now).toISOString();
      const batch = db.batch();
      let writes = 0;
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.courseCode === courseCode && !data.poolId) {
          batch.update(doc.ref, { lastSeenAt: nowIso });
          writes += 1;
        }
      }
      if (writes) await batch.commit();
    },
    snapshot,
    async joinQueue({ deviceId, displayName, courseCode, targetGroupSize, now }) {
      const existing = await db.collection(COL_QUEUE).where("deviceId", "==", deviceId).get();
      const batch = db.batch();
      for (const doc of existing.docs) {
        const data = doc.data();
        if (data.courseCode === courseCode && !data.poolId) batch.delete(doc.ref);
      }
      const nowIso = new Date(now).toISOString();
      const entryRef = db.collection(COL_QUEUE).doc();
      batch.set(entryRef, {
        deviceId,
        displayName,
        courseCode,
        targetGroupSize,
        joinedAt: nowIso,
        lastSeenAt: nowIso,
      });
      await batch.commit();

      const waiting = await loadQueue(courseCode);
      const matched = tryMatchWaiting(waiting, now);
      let matchedPublic: StudyPool | null = null;
      if (matched) {
        await db.runTransaction(async (tx) => {
          const memberRefs = matched.memberIds.map((id) => db.collection(COL_QUEUE).doc(id));
          const memberSnaps = await Promise.all(memberRefs.map((ref) => tx.get(ref)));
          const stillWaiting = memberSnaps.filter((snap) => snap.exists && !snap.data()?.poolId);
          if (stillWaiting.length < matched.pool.memberCount) return;
          const poolRef = db.collection(COL_POOLS).doc(matched.pool.id);
          const { memberDeviceIds, origin, ...rest } = matched.pool;
          tx.set(poolRef, { ...rest, memberDeviceIds, origin });
          for (const snap of stillWaiting) {
            tx.update(snap.ref, { poolId: matched.pool.id });
          }
        });
        const poolDoc = await db.collection(COL_POOLS).doc(matched.pool.id).get();
        if (poolDoc.exists) {
          matchedPublic = publicPool(asPoolRecord(poolDoc.id, poolDoc.data()!));
        }
      }
      return { ...(await snapshot(courseCode, deviceId, now)), matched: matchedPublic };
    },
    async leaveQueue({ deviceId, courseCode, now }) {
      const snap = await db.collection(COL_QUEUE).where("deviceId", "==", deviceId).get();
      const batch = db.batch();
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.courseCode === courseCode && !data.poolId) batch.delete(doc.ref);
      }
      await batch.commit();
      return snapshot(courseCode, deviceId, now);
    },
    async book({ deviceId, displayName, courseCode, spotName, bookingUrl, start, capacity, now, hostEmail }) {
      const ruling = resolveBookingCapacity(spotName, capacity);
      const ref = db.collection(COL_BOOKINGS).doc();
      const booking: RoomBooking = {
        id: ref.id,
        deviceId,
        hostDisplayName: displayName,
        courseCode,
        spotName,
        bookingUrl,
        start,
        capacity: ruling.capacity,
        capacityNote: ruling.note,
        members: [{ deviceId, displayName }],
        createdAt: new Date(now).toISOString(),
      };
      const audience = bookingAudience(courseCode);
      booking.notified = await notifyBooking(booking, await loadSubscriptions(audience), {
        hostEmail,
      });

      const payload = compactDeep({ ...booking, id: undefined }) as Record<string, unknown>;
      await ref.set(payload);
      return { ...(await snapshot(courseCode, deviceId, now)), booking };
    },
    async joinBooking({ deviceId, displayName, bookingId, courseCode, now }) {
      const ref = db.collection(COL_BOOKINGS).doc(bookingId);
      const booking = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpError(404, "booking not found");
        const current = asBooking(snap.id, snap.data()!);
        if (!current.members.some((m) => m.deviceId === deviceId)) {
          if (current.members.length >= current.capacity) {
            throw new HttpError(409, "booking full");
          }
          current.members.push({ deviceId, displayName });
          tx.update(ref, { members: current.members });
        }
        return current;
      });
      const code = normalizeCourseCode(courseCode || booking.courseCode);
      return { ...(await snapshot(code, deviceId, now)), booking };
    },
    async listPools(courseCode, now) {
      const pools = await loadPools(courseCode, now);
      return pools.map(publicPool);
    },
    async hostPool({ deviceId, courseCode, hostDisplayName, targetGroupSize, now }) {
      const ref = db.collection(COL_POOLS).doc();
      const pool: PoolRecord = {
        id: ref.id,
        courseCode,
        hostDisplayName,
        targetGroupSize,
        memberCount: 1,
        isDemoSample: false,
        createdAt: new Date(now).toISOString(),
        memberDeviceIds: [deviceId],
        origin: "host",
      };
      const { id: _id, ...data } = pool;
      void _id;
      await ref.set(data);
      return publicPool(pool);
    },
    async joinPool({ deviceId, poolId, now }) {
      const ref = db.collection(COL_POOLS).doc(poolId);
      const demo = DEMO_POOLS.find((p) => p.id === poolId);
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        let record: PoolRecord;
        if (!snap.exists) {
          if (!demo) throw new HttpError(404, "pool not found");
          record = { ...demo, memberDeviceIds: [], origin: "demo" };
          if (record.memberCount >= record.targetGroupSize) {
            throw new HttpError(409, "pool full");
          }
          record.memberDeviceIds.push(deviceId);
          record.memberCount += 1;
          const { id: _id, ...data } = record;
          void _id;
          tx.set(ref, data);
          return record;
        }
        record = asPoolRecord(snap.id, snap.data()!);
        if (!isPoolLive(record, now)) throw new HttpError(404, "pool not found");
        if (!record.memberDeviceIds.includes(deviceId)) {
          if (record.memberCount >= record.targetGroupSize) {
            throw new HttpError(409, "pool full");
          }
          tx.update(ref, {
            memberDeviceIds: FieldValue.arrayUnion(deviceId),
            memberCount: FieldValue.increment(1),
          });
          record.memberDeviceIds.push(deviceId);
          record.memberCount += 1;
        }
        return record;
      });
      return publicPool(result);
    },
    async subscribe({ deviceId, email, displayName, courseCodes, now }) {
      const address = email.trim().toLowerCase();
      const createdAt = new Date(now).toISOString();
      const wanted = Array.from(new Set(courseCodes));
      const batch = db.batch();
      for (const courseCode of wanted) {
        batch.set(
          db.collection(COL_SUBSCRIPTIONS).doc(subscriptionDocId(courseCode, address)),
          { courseCode, email: address, deviceId, displayName: displayName ?? "", createdAt },
        );
      }
      if (wanted.length) await batch.commit();
      return { courses: wanted };
    },
    async unsubscribe({ email }) {
      const address = email.trim().toLowerCase();
      const snap = await db.collection(COL_SUBSCRIPTIONS).where("email", "==", address).get();
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      if (snap.size) await batch.commit();
      return { removed: snap.size };
    },
    async seedDemoPools() {
      let written = 0;
      const batch = db.batch();
      for (const demo of DEMO_POOLS) {
        const ref = db.collection(COL_POOLS).doc(demo.id);
        const snap = await ref.get();
        if (snap.exists) continue;
        const { id: _id, ...rest } = demo;
        void _id;
        batch.set(ref, {
          ...rest,
          memberDeviceIds: [],
          origin: "demo",
        });
        written += 1;
      }
      if (written) await batch.commit();
      return { written, backend: backend.kind };
    },
    async releaseBooking({ deviceId, bookingId, courseCode, now }) {
      const ref = db.collection(COL_BOOKINGS).doc(bookingId);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(404, "booking not found");
      const booking = asBooking(snap.id, snap.data()!);
      if (booking.deviceId !== deviceId) throw new HttpError(403, "only the host can release");
      await ref.delete();
      const code = normalizeCourseCode(courseCode || booking.courseCode);
      return { ...(await snapshot(code, deviceId, now)), released: true };
    },
    async listPrivatePools({ deviceId, netId, email, now }) {
      const byId = new Map<string, PrivatePool>();
      const ingest = (docs: { id: string; data: () => DocumentData }[]) => {
        for (const d of docs) byId.set(d.id, asPrivatePool(d.id, d.data()));
      };
      try {
        const queries = [
          db.collection(COL_PRIVATE).where("hostDeviceId", "==", deviceId).get(),
          db.collection(COL_PRIVATE).where("memberDeviceIds", "array-contains", deviceId).get(),
        ];
        if (netId) {
          queries.push(db.collection(COL_PRIVATE).where("inviteeNetIds", "array-contains", netId).get());
        }
        if (email) {
          queries.push(
            db.collection(COL_PRIVATE).where("inviteeNetIds", "array-contains", email.toLowerCase()).get(),
          );
        }
        for (const qs of await Promise.all(queries)) ingest(qs.docs);
      } catch (error) {
        // Missing single-field indexes or a cold project: scan instead of 500.
        console.warn(
          "[studyspace] private pool query failed, scanning collection",
          error instanceof Error ? error.message : error,
        );
        const snap = await db.collection(COL_PRIVATE).get();
        ingest(snap.docs);
      }
      return Array.from(byId.values())
        .filter((p) => Date.parse(p.expiresAt) > now && canSeePrivatePool(p, deviceId, netId, email))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createPrivatePool(input) {
      const ref = db.collection(COL_PRIVATE).doc();
      const createdAt = new Date(input.now).toISOString();
      const pool: PrivatePool = {
        id: ref.id,
        hostDeviceId: input.deviceId,
        hostDisplayName: input.displayName,
        hostNetId: input.netId,
        reason: input.reason,
        note: input.note,
        courseCode: input.courseCode,
        spotName: input.spotName,
        bookingUrl: input.bookingUrl,
        start: input.start,
        inviteeNetIds: input.inviteeNetIds,
        declinedNetIds: [],
        members: [{ deviceId: input.deviceId, displayName: input.displayName, netId: input.netId }],
        createdAt,
        expiresAt: privatePoolExpiry({ start: input.start, createdAt }),
      };
      const { id: _id, ...data } = pool;
      void _id;
      await ref.set(compact({ ...data, memberDeviceIds: [input.deviceId] }));
      return pool;
    },
    async respondPrivatePool({ deviceId, displayName, netId, email, poolId, accept }) {
      const ref = db.collection(COL_PRIVATE).doc(poolId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpError(404, "private pool not found");
        const pool = asPrivatePool(snap.id, snap.data()!);
        if (!isInvited(pool, netId, email)) throw new HttpError(403, "not invited");
        if (accept) {
          pool.declinedNetIds = pool.declinedNetIds.filter((n) => n !== netId);
          if (!pool.members.some((m) => m.deviceId === deviceId || m.netId === netId)) {
            pool.members.push({ deviceId, displayName, netId });
          }
        } else {
          pool.members = pool.members.filter((m) => m.netId !== netId && m.deviceId !== deviceId);
          if (!pool.declinedNetIds.includes(netId)) pool.declinedNetIds.push(netId);
        }
        tx.update(ref, {
          members: pool.members,
          declinedNetIds: pool.declinedNetIds,
          memberDeviceIds: pool.members.map((m) => m.deviceId),
        });
        return pool;
      });
    },
    async cancelPrivatePool({ deviceId, poolId }) {
      const ref = db.collection(COL_PRIVATE).doc(poolId);
      const snap = await ref.get();
      if (!snap.exists) return { removed: false };
      const pool = asPrivatePool(snap.id, snap.data()!);
      if (pool.hostDeviceId !== deviceId) throw new HttpError(403, "only the host can cancel");
      await ref.delete();
      return { removed: true };
    },
  };
}

let cached: LiveStore | undefined;

export function getLiveStore(): LiveStore {
  if (cached) return cached;
  if (isFirebaseConfigured()) {
    try {
      cached = createFirestoreStore();
    } catch (error) {
      console.error(
        "[studyspace] Firestore store failed, using local fallback",
        error instanceof Error ? error.message : error,
      );
      cached = createLocalStore();
    }
  } else {
    cached = createLocalStore();
  }
  return cached;
}

/** Validate a subscription request the same way for every backend. */
export function assertEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim() : "";
  if (!email) throw new HttpError(400, "email required");
  if (email.length > 254 || !isEmailish(email)) {
    throw new HttpError(400, "email is not a valid address");
  }
  return email.toLowerCase();
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "internal error";
  console.error("[studyspace] api 500", message);
  return Response.json({ error: message }, { status: 500 });
}

export type EventSource = "gcal" | "coursetable-ics" | "syllabus" | "demo";

/** The two sources a user can actually import a calendar from. */
export type ParsedCalendarSource = Extract<EventSource, "gcal" | "coursetable-ics">;

/** One course on the user's own schedule, derived from imported calendars. */
export type MyCourse = {
  courseCode: string;
  title: string;
  /** Where the next (or most recent) meeting of this course is held. */
  location?: string;
  /** ISO start of the next upcoming meeting, when there is one. */
  nextStart?: string;
};

export type ClassMeeting = {
  courseCode: string;
  title: string;
  location?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  source: EventSource;
};

export type Deadline = {
  courseCode: string;
  title: string;
  due: string; // ISO 8601
  source: EventSource;
};

export type OfficeHour = {
  start: string;
  end: string;
  location?: string;
};

export type ParsedSyllabus = {
  courseCode: string;
  title: string;
  meetings: ClassMeeting[];
  officeHours: OfficeHour[];
  deadlines: Deadline[];
};

export type StudyPool = {
  id: string;
  courseCode: string;
  hostDisplayName: string;
  targetGroupSize: 1 | 2 | 3 | 4;
  memberCount: number;
  isDemoSample: boolean;
  createdAt: string;
};

export type GenerateIcsEvent = {
  summary: string;
  dtstart: string; // ISO 8601
};

export type StudyRecommendation = {
  kind: "coffee" | "room";
  name: string;
  /** Minutes on foot from a real origin. 0 means unknown — never a Phelps Gate default. */
  walkingMinutes: number;
  bookingUrl?: string;
  address?: string;
  lat?: number;
  lng?: number;
  /** Straight-line meters from the origin, set by the recommender. */
  distanceMeters?: number;
  /** Free-text description used by natural-language search. */
  description?: string;
  /** Short feature tags: "quiet", "whiteboard", "outlets", "group", ... */
  tags?: string[];
  /** Published seat count when Yale listed one. Omitted if unknown. */
  capacity?: number;
};

export type RoomPrefs = {
  examUrgency: number;
  includeCoffeeShops: boolean;
  maxExtraWalkingMinutes: number;
};

/** A person waiting in the live matchmaking queue for a course. */
export type QueueEntry = {
  id: string;
  deviceId: string;
  displayName: string;
  courseCode: string;
  targetGroupSize: number;
  joinedAt: string; // ISO
  lastSeenAt: string; // ISO, refreshed by polling
  /** Set once matched into a pool. */
  poolId?: string;
};

/** "I booked a room, come study" announcement sent to a class + similar catalog courses. */
export type RoomBooking = {
  id: string;
  deviceId: string;
  hostDisplayName: string;
  courseCode: string;
  spotName: string;
  bookingUrl?: string;
  start: string; // ISO
  /**
   * Seats, clamped to the room's published capacity. This is also the pool's
   * hard cap: a room that seats 1 can never host a group.
   */
  capacity: number;
  /** Why `capacity` is what it is, so the UI can explain a clamp. */
  capacityNote?: string;
  members: { deviceId: string; displayName: string }[];
  createdAt: string; // ISO
  /** Outcome of the announcement email, filled in by the server. */
  notified?: BookingNotifyResult;
};

/** What happened when the server tried to email a booking out. */
export type BookingNotifyResult = {
  /** Distinct addresses the announcement was addressed to. */
  recipients: number;
  /** Courses whose classmates were included, starting with the host's. */
  courses: string[];
  delivery: "sent" | "logged" | "skipped" | "failed";
  detail?: string;
  /** False when RESEND_API_KEY / MAIL_FROM are missing; nothing was delivered. */
  mailConfigured: boolean;
};

/**
 * An email we can write to for a course: a signed-in Yale classmate with
 * that course on their schedule, or someone who opted in on Connect.
 */
export type CourseSubscription = {
  courseCode: string;
  email: string;
  deviceId: string;
  displayName?: string;
  createdAt: string; // ISO
};

/** Which store is behind the live data, reported by the API for the UI chip. */
export type BackendInfo = {
  kind: "firestore" | "file" | "memory";
  label: string;
  durable: boolean;
  detail: string;
};

/** What the pools page polls for. */
export type QueueSnapshot = {
  serverTime: string;
  courseCode: string;
  similarCourses: { courseCode: string; label: string }[];
  queue: QueueEntry[];
  myEntry: QueueEntry | null;
  /** Pools formed by the matchmaker for this course. */
  pools: StudyPool[];
  /** Bookings for this course and similar-description ones; `via` explains the link. */
  bookings: (RoomBooking & { via?: string })[];
};

/** Why someone wants a private pool. "writing-tutor" is the common campus case. */
export type PrivatePoolReason =
  | "writing-tutor"
  | "writing-partner"
  | "problem-set"
  | "project"
  | "other";

export const PRIVATE_POOL_REASONS: { value: PrivatePoolReason; label: string }[] = [
  { value: "writing-tutor", label: "Writing tutor program" },
  { value: "writing-partner", label: "Writing partner" },
  { value: "problem-set", label: "Problem set" },
  { value: "project", label: "Project meeting" },
  { value: "other", label: "Other" },
];

export type PrivatePoolMember = {
  deviceId: string;
  displayName: string;
  netId: string;
};

/**
 * An invite-only pool. Visible only to the host and the NetIDs invited.
 * Nothing about it appears on the public course lists.
 */
export type PrivatePool = {
  id: string;
  hostDeviceId: string;
  hostDisplayName: string;
  hostNetId: string;
  reason: PrivatePoolReason;
  note?: string;
  courseCode?: string;
  spotName?: string;
  bookingUrl?: string;
  /** ISO; when the session is meant to start. */
  start?: string;
  inviteeNetIds: string[];
  declinedNetIds: string[];
  members: PrivatePoolMember[];
  createdAt: string; // ISO
  expiresAt: string; // ISO
};

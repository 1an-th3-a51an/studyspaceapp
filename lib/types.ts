export type EventSource = "gcal" | "coursetable-ics" | "syllabus" | "demo";

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
  /** Minutes on foot from the chosen origin. Recomputed from lat/lng when present. */
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
  /** How many people fit comfortably. */
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

/** "I booked a room, come study" announcement sent to a class + adjacent classes. */
export type RoomBooking = {
  id: string;
  deviceId: string;
  hostDisplayName: string;
  courseCode: string;
  spotName: string;
  bookingUrl?: string;
  start: string; // ISO
  capacity: number;
  members: { deviceId: string; displayName: string }[];
  createdAt: string; // ISO
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
  /** Bookings for this course and adjacent ones; `via` explains adjacency. */
  bookings: (RoomBooking & { via?: string })[];
};

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
  walkingMinutes: number;
  bookingUrl?: string;
};

export type RoomPrefs = {
  examUrgency: number;
  includeCoffeeShops: boolean;
  maxExtraWalkingMinutes: number;
};

import type {
  ClassMeeting,
  Deadline,
  ParsedSyllabus,
  StudyPool,
  StudyRecommendation,
} from "@/lib/types";

export const DEMO_DISPLAY_NAME = "Handsome Dan";

export const DEMO_SYLLABUS: ParsedSyllabus = {
  courseCode: "CPSC 223",
  title: "Data Structures and Programming Techniques",
  meetings: [
    {
      courseCode: "CPSC 223",
      title: "Lecture",
      location: "Davies Auditorium",
      start: "2026-09-14T10:30:00-04:00",
      end: "2026-09-14T11:45:00-04:00",
      source: "demo",
    },
  ],
  officeHours: [
    {
      start: "2026-09-16T14:00:00-04:00",
      end: "2026-09-16T16:00:00-04:00",
      location: "AKW 000",
    },
  ],
  deadlines: [
    {
      courseCode: "CPSC 223",
      title: "Problem Set 1",
      due: "2026-09-18T23:59:00-04:00",
      source: "demo",
    },
  ],
};

export const DEMO_MEETINGS: ClassMeeting[] = [
  ...DEMO_SYLLABUS.meetings,
  {
    courseCode: "ECON 115",
    title: "Introductory Microeconomics",
    location: "Luce Hall 101",
    start: "2026-09-15T09:00:00-04:00",
    end: "2026-09-15T10:15:00-04:00",
    source: "demo",
  },
  {
    courseCode: "HIST 202",
    title: "European Civilization seminar",
    location: "HQ 107",
    start: "2026-09-16T13:30:00-04:00",
    end: "2026-09-16T15:20:00-04:00",
    source: "demo",
  },
];

export const DEMO_DEADLINES: Deadline[] = [
  ...DEMO_SYLLABUS.deadlines,
  {
    courseCode: "ECON 115",
    title: "Problem Set 2",
    due: "2026-09-17T17:00:00-04:00",
    source: "demo",
  },
  {
    courseCode: "HIST 202",
    title: "Weekly response paper",
    due: "2026-09-19T12:00:00-04:00",
    source: "demo",
  },
];

export const DEMO_RECOMMENDATIONS: StudyRecommendation[] = [
  {
    kind: "coffee",
    name: "Koffee? (Audubon St)",
    walkingMinutes: 4,
  },
  {
    kind: "coffee",
    name: "Blue State Coffee",
    walkingMinutes: 7,
  },
  {
    kind: "room",
    name: "Bass Library Group Study",
    walkingMinutes: 6,
    bookingUrl: "https://schedule.yale.edu/space/36623",
  },
  {
    kind: "room",
    name: "Sterling Memorial Library Nave",
    walkingMinutes: 9,
  },
];

export const DEMO_POOLS: StudyPool[] = [
  {
    id: "demo-cpsc-223",
    courseCode: "CPSC 223",
    hostDisplayName: "[Demo Sample] Eli '27",
    targetGroupSize: 3,
    memberCount: 2,
    isDemoSample: true,
    createdAt: "2026-09-08T14:00:00.000Z",
  },
  {
    id: "demo-econ-115",
    courseCode: "ECON 115",
    hostDisplayName: "[Demo Sample] Handsome Dan",
    targetGroupSize: 4,
    memberCount: 1,
    isDemoSample: true,
    createdAt: "2026-09-09T09:30:00.000Z",
  },
  {
    id: "demo-hist-202",
    courseCode: "HIST 202",
    hostDisplayName: "[Demo Sample] Maya '28",
    targetGroupSize: 2,
    memberCount: 2,
    isDemoSample: true,
    createdAt: "2026-09-10T11:15:00.000Z",
  },
];

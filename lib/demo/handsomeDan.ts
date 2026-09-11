import type {
  ClassMeeting,
  Deadline,
  ParsedSyllabus,
  StudyPool,
  StudyRecommendation,
} from "@/lib/types";

export const DEMO_DISPLAY_NAME = "Handsome Dan";
export const DEFAULT_COURSE_CODE = "S&DS 2380";

export const DEMO_SYLLABUS: ParsedSyllabus = {
  courseCode: "S&DS 2380",
  title: "Probability and Bayesian Statistics",
  meetings: [
    {
      courseCode: "S&DS 2380",
      title: "Probability and Bayesian Statistics",
      location: "HQ L02",
      start: "2026-09-14T13:05:00-04:00",
      end: "2026-09-14T14:20:00-04:00",
      source: "demo",
    },
  ],
  officeHours: [],
  deadlines: [
    {
      courseCode: "S&DS 2380",
      title: "Problem set 1",
      due: "2026-09-17T23:59:00-04:00",
      source: "demo",
    },
  ],
};

export const DEMO_MEETINGS: ClassMeeting[] = [
  ...DEMO_SYLLABUS.meetings,
  {
    courseCode: "AMST 1197",
    title: "American Architecture and Urbanism",
    location: "YUAG AUD",
    start: "2026-09-15T11:35:00-04:00",
    end: "2026-09-15T12:25:00-04:00",
    source: "demo",
  },
  {
    courseCode: "ASL 1100",
    title: "American Sign Language I",
    location: "HQ 229",
    start: "2026-09-16T08:20:00-04:00",
    end: "2026-09-16T09:10:00-04:00",
    source: "demo",
  },
];

export const DEMO_DEADLINES: Deadline[] = [
  ...DEMO_SYLLABUS.deadlines,
  {
    courseCode: "AMST 1197",
    title: "Assignment 1",
    due: "2026-10-09T23:59:00-04:00",
    source: "demo",
  },
  {
    courseCode: "ASL 1100",
    title: "Unit 1 receptive quiz",
    due: "2026-09-19T12:00:00-04:00",
    source: "demo",
  },
];

export const DEMO_RECOMMENDATIONS: StudyRecommendation[] = [
  {
    kind: "coffee",
    name: "Common Grounds",
    address: "276 York St",
    walkingMinutes: 2,
    lat: 41.31135,
    lng: -72.93155,
    capacity: 8,
    description:
      "Independent cafe on York Street in the Broadway shops, a short walk from HQ and Cross Campus. Espresso, pastries, and a handful of two-tops plus a window bar. Wifi and some outlets. Fine for a problem-set pair or a coffee meetup; too small and public for a six-person review session.",
    tags: ["coffee", "food", "wifi", "outlets", "background noise", "pair", "york street", "near hq", "meetup"],
  },
  {
    kind: "room",
    name: "Bass Library Group Study L30A",
    address: "110 Wall St",
    walkingMinutes: 4,
    bookingUrl: "https://schedule.yale.edu/space/113265",
    lat: 41.3109,
    lng: -72.928,
    capacity: 6,
    description:
      "Reservable group study room on the lower level of Bass. Seats six, with power, wireless, an LCD display and laptop connectors, and a portable whiteboard you can roll in. Enclosed enough to talk through a pset. Food is not allowed. Book at schedule.yale.edu; Yale ID to swipe in.",
    tags: ["group", "whiteboard", "monitor", "quiet", "enclosed", "reservable", "central campus", "no food", "bass"],
  },
  {
    kind: "room",
    name: "Bass Library C10F",
    address: "110 Wall St",
    walkingMinutes: 4,
    bookingUrl: "https://schedule.yale.edu/space/128473",
    lat: 41.31095,
    lng: -72.9279,
    capacity: 1,
    description:
      "ADA-accessible individual study room on the courtyard level of Bass, facing Thain Cafe. One desk with a lamp, power, and wireless. Students may book up to four hours once per day. Strictly solo — do not use this for a group.",
    tags: ["solo", "quiet", "enclosed", "reservable", "outlets", "private", "accessible", "central campus", "bass"],
  },
];

export const DEMO_POOLS: StudyPool[] = [
  {
    id: "demo-sds-2380",
    courseCode: "S&DS 2380",
    hostDisplayName: "[Demo Sample] Eli '27",
    targetGroupSize: 3,
    memberCount: 2,
    isDemoSample: true,
    createdAt: "2026-09-08T14:00:00.000Z",
  },
  {
    id: "demo-amst-1197",
    courseCode: "AMST 1197",
    hostDisplayName: "[Demo Sample] Handsome Dan",
    targetGroupSize: 3,
    memberCount: 2,
    isDemoSample: true,
    createdAt: "2026-09-10T11:15:00.000Z",
  },
  {
    id: "demo-asl-1100",
    courseCode: "ASL 1100",
    hostDisplayName: "[Demo Sample] Maya '28",
    targetGroupSize: 2,
    memberCount: 2,
    isDemoSample: true,
    createdAt: "2026-09-10T11:15:00.000Z",
  },
];

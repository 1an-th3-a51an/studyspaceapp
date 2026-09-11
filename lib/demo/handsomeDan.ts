import type {
  ClassMeeting,
  Deadline,
  ParsedSyllabus,
  StudyPool,
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

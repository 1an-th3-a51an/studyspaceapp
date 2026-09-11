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
    name: "Koffee?",
    address: "104 Audubon St",
    walkingMinutes: 4,
    lat: 41.3128,
    lng: -72.9216,
    capacity: 3,
    description:
      "Cozy neighborhood cafe near Science Hill and the engineering buildings. Great espresso, pastries, and a lively hum of chatter. Some outlets along the wall; wifi is decent. Good for reading or light solo work, not for whiteboard sessions.",
    tags: ["coffee", "food", "wifi", "outlets", "background noise", "solo", "near science hill", "cozy"],
  },
  {
    kind: "coffee",
    name: "Blue State Coffee",
    address: "84 Wall St",
    walkingMinutes: 7,
    lat: 41.3105,
    lng: -72.9265,
    capacity: 4,
    description:
      "Busy campus coffee shop steps from Cross Campus and Bass. Big communal tables, plenty of outlets, loud during rush. Fine for a pair working on a problem set with laptops; too noisy for focused reading.",
    tags: ["coffee", "food", "wifi", "outlets", "loud", "communal tables", "central campus", "laptops"],
  },
  {
    kind: "coffee",
    name: "Atticus Bookstore Cafe",
    address: "1082 Chapel St",
    walkingMinutes: 12,
    lat: 41.3082,
    lng: -72.9301,
    capacity: 4,
    description:
      "Bookstore cafe on Chapel Street with soup, sandwiches, and bread. Warm and relatively calm in the afternoon. Limited outlets, so charge first. Nice for reading a novel or writing an essay over a long lunch.",
    tags: ["coffee", "food", "lunch", "calm", "reading", "writing", "bookstore", "limited outlets"],
  },
  {
    kind: "coffee",
    name: "Willoughby's Coffee & Tea",
    address: "194 York St",
    walkingMinutes: 11,
    lat: 41.3095,
    lng: -72.9307,
    capacity: 2,
    description:
      "Small serious coffee shop with excellent pour-over. Few seats and few outlets, so it is best for a quick caffeine stop or a short one-on-one meeting rather than a study session.",
    tags: ["coffee", "tea", "quick", "small", "meeting", "few seats", "no outlets"],
  },
  {
    kind: "room",
    name: "Bass Library Group Study",
    address: "110 Wall St",
    walkingMinutes: 6,
    bookingUrl: "https://schedule.yale.edu/space/36623",
    lat: 41.3109,
    lng: -72.928,
    capacity: 6,
    description:
      "Reservable group study room under Cross Campus with a large whiteboard, a wall monitor you can plug a laptop into, and seating for six. Enclosed and quiet enough for a recorded practice presentation. Open late most nights. Food is not allowed.",
    tags: ["group", "whiteboard", "monitor", "quiet", "enclosed", "reservable", "late night", "presentation", "no food", "central campus"],
  },
  {
    kind: "room",
    name: "Sterling Memorial Library Nave",
    address: "120 High St",
    walkingMinutes: 9,
    lat: 41.3112,
    lng: -72.9288,
    capacity: 1,
    description:
      "Silent cathedral-like reading room with long wooden tables, green lamps, and natural light through stained glass. Strictly quiet, no talking, no food. Ideal for deep solo reading, memorizing, or writing when you need zero distractions.",
    tags: ["silent", "quiet", "solo", "reading", "natural light", "beautiful", "no talking", "no food", "focus"],
  },
  {
    kind: "room",
    name: "Marx Science & Social Science Library",
    address: "219 Prospect St",
    walkingMinutes: 8,
    bookingUrl: "https://schedule.yale.edu/spaces",
    lat: 41.3172,
    lng: -72.9226,
    capacity: 8,
    description:
      "Modern library on Science Hill with bookable group rooms, whiteboards on every wall, dual monitors, and lots of outlets. Bright, open floor with a busyness meter. Best for STEM problem sets, coding with a partner, or a lab group meeting near Kline.",
    tags: ["group", "whiteboard", "monitors", "outlets", "science hill", "stem", "coding", "bright", "bookable", "busyness"],
  },
  {
    kind: "room",
    name: "CEID Study Space",
    address: "15 Prospect St",
    walkingMinutes: 2,
    bookingUrl: "https://schedule.yale.edu/spaces",
    lat: 41.3124,
    lng: -72.9252,
    capacity: 10,
    description:
      "Open collaborative space in the Center for Engineering Innovation and Design with standing tables, whiteboards, 3D printers, and tools. Noisy and social. Good for a project team building something, prototyping, or a hackathon-style sprint. Members only after hours.",
    tags: ["group", "collaborative", "whiteboard", "makerspace", "loud", "project", "prototyping", "engineering", "standing desks", "near davies"],
  },
  {
    kind: "room",
    name: "Humanities Quadrangle Study Room",
    address: "320 York St",
    walkingMinutes: 10,
    bookingUrl: "https://schedule.yale.edu/spaces",
    lat: 41.3117,
    lng: -72.9306,
    capacity: 4,
    description:
      "Small seminar-style room in the new Humanities Quadrangle with a round table, a whiteboard, and a window onto the courtyard. Quiet and private. Suited to a discussion section prep, a language conversation group, or reviewing essays together.",
    tags: ["group", "small", "whiteboard", "quiet", "private", "seminar", "humanities", "discussion", "window", "essays"],
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
  {
    id: "demo-math-225",
    courseCode: "MATH 225",
    hostDisplayName: "[Demo Sample] Priya '28",
    targetGroupSize: 3,
    memberCount: 1,
    isDemoSample: true,
    createdAt: "2026-09-09T18:45:00.000Z",
  },
  {
    id: "demo-cpsc-202",
    courseCode: "CPSC 202",
    hostDisplayName: "[Demo Sample] Theo '27",
    targetGroupSize: 4,
    memberCount: 2,
    isDemoSample: true,
    createdAt: "2026-09-10T08:05:00.000Z",
  },
  {
    id: "demo-econ-116",
    courseCode: "ECON 116",
    hostDisplayName: "[Demo Sample] Sofia '29",
    targetGroupSize: 2,
    memberCount: 1,
    isDemoSample: true,
    createdAt: "2026-09-10T15:20:00.000Z",
  },
];

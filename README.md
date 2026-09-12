<img width="1916" height="1078" alt="Screenshot 2026-09-11 222044" src="https://github.com/user-attachments/assets/dc40eb08-549e-4cdc-9d1c-38c861fbbacf" />
<img width="1916" height="1078" alt="Screenshot 2026-09-11 222044" src="https://github.com/user-attachments/assets/3b6689f3-afb0-493e-99e0-6cf3acb47240" /># StudySpace

Yale study pooling app: merge a CourseTable `.ics` with Google Calendar, join a study pool by course code, and pick a nearby coffee shop or Bass Library room.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo Mode loads Handsome Dan’s fall 2026 schedule (S&DS 2380, AMST 1197, ASL 1100) from `lib/demo/handsomeDan.ts` — no Canvas, no OAuth.

Optional: set `OPENAI_API_KEY` for syllabus parsing and embedding search. Without it, those routes fall back to local/lexical logic.

## Backend

Live queues, hosted pools, and room-booking announcements go through Next.js API routes (`/api/queue`, `/api/pools`, `/api/seed-db`). Users are still just a `deviceId` in localStorage — no Canvas, no OAuth.

If `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (or `FIREBASE_SERVICE_ACCOUNT`) are set, those collections persist in Firestore (`study_pools`, `queue_entries`, `room_bookings`). Without them the same logic runs in memory on the Node process, which is enough for a single-server demo. Seed DB writes Handsome Dan’s sample pools.

Copy `.env.example` to `.env.local` to configure keys.

## Course codes

Yale College catalog numbers are **four digits** (`S&DS 2380`, not `S&DS 238`). CourseTable’s ICS `SUMMARY` is only the catalog code; the human title (`Probability and Bayesian Statistics`) is the first line of `DESCRIPTION`. The parser in `lib/icsParse.ts` uses that split. `&` in department codes is kept (`S&DS`, not `DS`).

## Course similarity — why the graph looks like this

`lib/courseSimilarity.ts` is a **seeded sample**, not a live CourseTable export. The UI labels it that way. Two signals:

1. **Equivalence groups** — alternative tracks for the same material (MATH 2220 / 2250 / 2260). Students almost never take two, so co-enrollment data cannot link them.
2. **Co-enrollment** — “students who took X also took Y,” with a made-up share in 0..1.

Handsome Dan’s three courses are **not** linked to each other. A stats lecture, an architecture survey, and ASL I are a plausible one-person schedule, not a cohort. Adjacent pools for S&DS 2380 are other quantitative courses (S&DS 2300, MATH 1200, linear algebra, CPSC 2020, ECON 1350), not AMST/ASL. AMST 1197 fans out to art history / architecture / US history; ASL 1100 to linguistics and other intro languages.

Shares are round numbers in the 0.14–0.46 range so the UI has something to show. Replace `CO_ENROLLMENT_SAMPLE` with a real CourseTable dump when one exists.

## Demo study spots

Three spots, with walking time recomputed from lat/lng when an origin is set:

| Spot | Why it’s here |
| --- | --- |
| Common Grounds, 276 York St | Real cafe a block from HQ. Default ~2 min walk from HQ L02. |
| Bass L30A | Group room, capacity 6, [schedule.yale.edu/space/113265](https://schedule.yale.edu/space/113265). |
| Bass C10F | ADA individual room by Thain Cafe, capacity 1, [schedule.yale.edu/space/128473](https://schedule.yale.edu/space/128473). |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

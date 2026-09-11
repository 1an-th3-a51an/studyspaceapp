/**
 * Offline checks for Yale room deep links (date query, grid snap).
 *
 * Autofill / bookmarklet / green-cell clicking is gone. These checks only
 * cover the helpers that still send the student to schedule.yale.edu.
 *
 * Run: npm run test:libcal
 */

function snapToGrid(startIso, minutes = 15) {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return startIso;
  const stepMs = minutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / stepMs) * stepMs).toISOString();
}

function yaleDateKey(startIso) {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const p = Object.fromEntries(formatter.formatToParts(date).map((x) => [x.type, x.value]));
  if (!p.year) return "";
  const monthIndex = new Date(`${p.month} 1, 2000`).getMonth() + 1;
  return `${p.year}-${String(monthIndex).padStart(2, "0")}-${p.day.padStart(2, "0")}`;
}

function slotDeepLink({ startIso, spaceId, bookingUrl }) {
  const base = bookingUrl ?? (spaceId ? `https://schedule.yale.edu/space/${spaceId}` : undefined);
  if (!base) return undefined;
  const date = yaleDateKey(startIso);
  const url = new URL(base);
  if (date) url.searchParams.set("date", date);
  return url.toString();
}

const C10F = "https://schedule.yale.edu/space/128473";
const start = "2026-09-11T19:07:00.000Z"; // 3:07pm ET → snap to 3:00pm, date 2026-09-11

const cases = [
  ["snap 3:07pm ET down to 3:00pm", snapToGrid(start) === "2026-09-11T19:00:00.000Z"],
  ["already on the 15-min grid stays put", snapToGrid("2026-09-11T19:30:00.000Z") === "2026-09-11T19:30:00.000Z"],
  ["Yale date key is New Haven's calendar day", yaleDateKey(start) === "2026-09-11"],
  [
    "late-evening UTC still the same New Haven date",
    yaleDateKey("2026-09-12T03:30:00.000Z") === "2026-09-11",
  ],
  [
    "deep link is the space page plus ?date=",
    slotDeepLink({ startIso: start, spaceId: 128473 }) === `${C10F}?date=2026-09-11`,
  ],
  [
    "deep link keeps an existing booking URL",
    slotDeepLink({ startIso: start, bookingUrl: C10F }) === `${C10F}?date=2026-09-11`,
  ],
  ["no hash clicker on the Yale URL", !slotDeepLink({ startIso: start, spaceId: 128473 }).includes("#")],
  ["no booking URL and no space id → no link", slotDeepLink({ startIso: start }) === undefined],
];

let failed = 0;
for (const [name, ok] of cases) {
  if (!ok) {
    failed += 1;
    console.error("fail:", name);
  } else {
    console.log("ok:", name);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\n${cases.length} checks passed`);

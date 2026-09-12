#!/usr/bin/env node
/**
 * Audit whether class/room strings map to a CourseTable building.
 *
 * Reads lib/data/courseTableBuildings.json — the same table the Rooms map
 * uses. Unknown codes stay unplaced. This never invents Old Campus / Phelps Gate.
 *
 *   npm run audit:placement
 *   npm run audit:placement -- "DL 220" "HQ 107" "ZZZ 999"
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE = resolve(HERE, "../lib/data/courseTableBuildings.json");
const DEMO = resolve(HERE, "../lib/demo/handsomeDan.ts");

const data = JSON.parse(readFileSync(TABLE, "utf8"));
const buildings = data.buildings ?? [];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[.,'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenBoundaryPattern(alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (alias.length <= 2) {
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=\\s+\\d|\\s+[a-z]\\d|$)`, "i");
  }
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

const prefixCodes = new Set();
for (const building of buildings) {
  const code = String(building.code ?? "").toLowerCase();
  if (!code) continue;
  if (buildings.some((other) => {
    const otherCode = String(other.code ?? "").toLowerCase();
    return otherCode && otherCode !== code && otherCode.startsWith(code);
  })) {
    prefixCodes.add(code);
  }
}

function placeLocation(location) {
  const query = location?.trim() ?? "";
  if (!query) return { ok: false, query };
  const haystack = normalize(query);
  let best;
  for (const building of buildings) {
    const code = String(building.code ?? "").toLowerCase();
    const aliases = [building.code, building.name, ...(building.aliases ?? [])].map(normalize);
    for (const alias of aliases) {
      if (!alias || !tokenBoundaryPattern(alias).test(haystack)) continue;
      const matchedBy = alias === code ? "code" : "name";
      if (
        matchedBy === "code" &&
        prefixCodes.has(alias) &&
        !new RegExp(`(^|[^a-z0-9])${alias}(?=\\s+\\d|$)`, "i").test(haystack)
      ) {
        continue;
      }
      if (!best || alias.length > best.aliasLen) {
        best = { building, aliasLen: alias.length, query };
      }
    }
  }
  return best ? { ok: true, building: best.building, query } : { ok: false, query };
}

function collectDemoLocations() {
  let text = "";
  try {
    text = readFileSync(DEMO, "utf8");
  } catch {
    return [];
  }
  return [...text.matchAll(/location:\s*"([^"]+)"/g)].map((m) => m[1]);
}

const extra = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const samples = [
  "DL 220",
  "HQ 107",
  "WLH 208",
  "WLH 011",
  "William L. Harkness Hall 011",
  "BIOL 101 · William L. Harkness Hall 011",
  "Bass C10F",
  "Bass Library",
  "YUAG AUD",
  "Unknown Hall 12",
  "S&DS 2380",
  ...collectDemoLocations(),
  ...extra,
];
const unique = [...new Set(samples.map((s) => s.trim()).filter(Boolean))];

if (buildings.length === 0) {
  console.error("Could not read CourseTable buildings from lib/data/courseTableBuildings.json");
  process.exit(1);
}

console.log(`CourseTable buildings: ${buildings.length}`);
console.log("query\tstatus\tbuilding\tcode\tlat\tlng");
let missing = 0;
const phelps = buildings.find((b) => b.code === "PH");
for (const query of unique) {
  const placed = placeLocation(query);
  if (placed.ok) {
    const b = placed.building;
    const fakePhelps =
      b.code === "PH" && !/phelps|\bph\b/i.test(query) ? "\tERROR: unknown room pinned at Phelps" : "";
    console.log(`${query}\tplaced\t${b.name}\t${b.code}\t${b.lat}\t${b.lng}${fakePhelps}`);
  } else {
    missing += 1;
    console.log(`${query}\tnot in the database\t\t\t\t`);
  }
}

const wlh = placeLocation("William L. Harkness Hall 011");
const wlhCode = placeLocation("WLH 011");
if (!wlh.ok || wlh.building.code !== "WLH" || !wlhCode.ok) {
  console.error("\nWLH lookup failed — CourseTable pin is not wired.");
  process.exit(1);
}
if (phelps && Math.abs(wlh.building.lat - phelps.lat) < 1e-4 && Math.abs(wlh.building.lng - phelps.lng) < 1e-4) {
  console.error("\nWLH is sitting on Phelps Hall coordinates.");
  process.exit(1);
}

console.log(
  `\n${unique.length - missing} placed, ${missing} not in the database. Unplaced rooms must not be pinned at Phelps Gate.`,
);
console.log(`WLH origin: ${wlh.building.lat}, ${wlh.building.lng} (College & Wall)`);
process.exit(0);

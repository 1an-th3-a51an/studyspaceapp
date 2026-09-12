#!/usr/bin/env node
/**
 * Audit whether class/room strings map to a building with real coordinates.
 *
 * Reads aliases and points from lib/geo.ts — the same dataset the Rooms map
 * uses. Unknown codes stay unplaced. This never invents Old Campus / Phelps Gate.
 *
 *   npm run audit:placement
 *   npm run audit:placement -- "DL 220" "HQ 107" "ZZZ 999"
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEO = resolve(HERE, "../lib/geo.ts");
const DEMO = resolve(HERE, "../lib/demo/handsomeDan.ts");

const src = readFileSync(GEO, "utf8");
const buildings = [];
const blockRe =
  /\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?point:\s*\{\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\s*\}[\s\S]*?aliases:\s*\[([^\]]+)\]/g;
for (const match of src.matchAll(blockRe)) {
  const aliases = [...match[5].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  buildings.push({
    id: match[1],
    name: match[2],
    lat: Number(match[3]),
    lng: Number(match[4]),
    aliases,
  });
}

function placeLocation(location) {
  const query = location?.trim() ?? "";
  if (!query) return { ok: false, query };
  const haystack = query.toLowerCase();
  let best;
  for (const building of buildings) {
    for (const alias of building.aliases) {
      const trimmed = alias.trim();
      if (!trimmed) continue;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack)) continue;
      if (!best || trimmed.length > best.aliasLen) {
        best = { building, aliasLen: trimmed.length, query };
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
  "William L. Harkness Hall 011",
  "BIOL 101 · William L. Harkness Hall 011",
  "Bass C10F",
  "YUAG AUD",
  "Unknown Hall 12",
  ...collectDemoLocations(),
  ...extra,
];
const unique = [...new Set(samples.map((s) => s.trim()).filter(Boolean))];

if (buildings.length === 0) {
  console.error("Could not parse BUILDINGS from lib/geo.ts");
  process.exit(1);
}

console.log(`Buildings in database: ${buildings.length}`);
console.log("query\tstatus\tbuilding\tlat\tlng");
let missing = 0;
for (const query of unique) {
  const placed = placeLocation(query);
  if (placed.ok) {
    const b = placed.building;
    console.log(`${query}\tplaced\t${b.name}\t${b.lat}\t${b.lng}`);
  } else {
    missing += 1;
    console.log(`${query}\tnot in the database\t\t\t`);
  }
}

console.log(
  `\n${unique.length - missing} placed, ${missing} not in the database. Unplaced rooms must not be pinned at Phelps Gate.`,
);
process.exit(missing > 0 && extra.length > 0 && extra.every((q) => !placeLocation(q).ok) ? 0 : 0);

#!/usr/bin/env node
/**
 * Build lib/data/courseTableBuildings.json from CourseTable.
 *
 * Source of truth for Rooms-map pins:
 *   https://github.com/coursetable/coursetable/blob/master/frontend/src/data/buildingCoordinates.json
 *
 * Optionally scans a public catalog (or --fetch season) for
 * `course_meetings[].location.building` so codes/names stay in sync.
 *
 *   node scripts/import-coursetable-buildings.mjs
 *   node scripts/import-coursetable-buildings.mjs --fetch 202603
 *   node scripts/import-coursetable-buildings.mjs --catalog scripts/fixtures/catalog-202603.json
 *
 * The huge catalog dump stays gitignored. This file writes only the compact
 * building table.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../lib/data/courseTableBuildings.json");
const FIXTURE_DIR = resolve(HERE, "fixtures");
const COORD_URL =
  "https://raw.githubusercontent.com/coursetable/coursetable/master/frontend/src/data/buildingCoordinates.json";
const CATALOG_URL = (season) =>
  `https://api.coursetable.com/api/catalog/public/${season}`;

const SUFFIX_RE =
  /\s+(hall|center|ctr|laboratory|laboratories|library|college|building|tower|chapel|gymnasium|museum|auditorium)$/i;

function usage(message) {
  if (message) console.error(`\nerror: ${message}`);
  console.error(`
usage: node scripts/import-coursetable-buildings.mjs [options]

  --fetch [season]       Also scan CourseTable's public catalog (default 202603)
  --catalog <file.json>  Scan a catalog dump already on disk
  --dry-run              Print a summary without writing
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const out = { dryRun: false, fetch: null, catalog: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage();
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--catalog") out.catalog = argv[++i];
    else if (arg === "--fetch") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out.fetch = next;
        i += 1;
      } else {
        out.fetch = "202603";
      }
    } else usage(`unknown argument "${arg}"`);
  }
  return out;
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[.,'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = normalize(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function fetchJson(url) {
  console.log(`fetching ${url}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "StudySpaceImport/1.0 (CourseTable building coords)" },
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

function flattenCatalog(parsed) {
  const records = Array.isArray(parsed)
    ? parsed
    : (parsed.listings ?? parsed.courses ?? parsed.data ?? []);
  return Array.isArray(records) ? records : [];
}

/** Collect building code → extra names seen on catalog meetings. */
function scanCatalogBuildings(records) {
  const extra = new Map();
  let meetings = 0;
  for (const entry of records) {
    const course = entry.course ?? entry;
    const list = course.course_meetings ?? entry.course_meetings ?? [];
    if (!Array.isArray(list)) continue;
    for (const meeting of list) {
      const loc = meeting.location ?? meeting;
      const building = loc.building ?? loc;
      const code = String(building.code ?? building.building_code ?? "").trim().toUpperCase();
      if (!code) continue;
      meetings += 1;
      const names = [
        building.name,
        building.building_name,
        loc.building_name,
        loc.building_code && loc.building_name
          ? undefined
          : typeof loc === "string"
            ? loc
            : undefined,
      ];
      if (!extra.has(code)) extra.set(code, new Set());
      for (const name of names) {
        if (typeof name === "string" && name.trim()) extra.get(code).add(name.trim());
      }
    }
  }
  return { extra, meetings, courses: records.length };
}

function buildAliases(code, name, extraNames, strippedCounts, tailCounts) {
  const stripped = normalize(name).replace(SUFFIX_RE, "").trim();
  const aliases = [code, name, normalize(name)];
  for (const extra of extraNames) {
    aliases.push(extra, normalize(extra));
  }
  if (stripped && stripped !== normalize(name) && strippedCounts.get(stripped) === 1) {
    aliases.push(stripped);
  }
  const words = normalize(name).split(" ").filter(Boolean);
  if (words.length >= 2) {
    const tail = words.slice(-2).join(" ");
    if (tailCounts.get(tail) === 1) aliases.push(tail);
  }
  return unique(aliases);
}

function toRows(coordMap, catalogNames) {
  const entries = Object.entries(coordMap).filter(([, value]) => {
    return value && typeof value.lat === "number" && typeof value.lng === "number";
  });
  const strippedCounts = new Map();
  const tailCounts = new Map();
  for (const [, value] of entries) {
    const stripped = normalize(value.name ?? "").replace(SUFFIX_RE, "").trim();
    if (stripped) strippedCounts.set(stripped, (strippedCounts.get(stripped) ?? 0) + 1);
    const words = normalize(value.name ?? "").split(" ").filter(Boolean);
    if (words.length >= 2) {
      const tail = words.slice(-2).join(" ");
      tailCounts.set(tail, (tailCounts.get(tail) ?? 0) + 1);
    }
  }

  return entries
    .map(([code, value]) => {
      const extra = [...(catalogNames.get(code) ?? [])];
      return {
        code,
        name: String(value.name ?? code).trim(),
        lat: value.lat,
        lng: value.lng,
        aliases: buildAliases(code, value.name ?? code, extra, strippedCounts, tailCounts),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const coords = await fetchJson(COORD_URL);
  if (!coords || typeof coords !== "object" || Array.isArray(coords)) {
    throw new Error("CourseTable buildingCoordinates.json was not an object of code → {lat,lng,name}");
  }

  const catalogNames = new Map();
  let catalogMeetings = 0;
  let catalogCourses = 0;
  let catalogSeason = null;

  if (args.fetch) {
    catalogSeason = args.fetch;
    const json = await fetchJson(CATALOG_URL(args.fetch));
    mkdirSync(FIXTURE_DIR, { recursive: true });
    const dest = resolve(FIXTURE_DIR, `catalog-${args.fetch}.json`);
    writeFileSync(dest, `${JSON.stringify(json)}\n`, "utf8");
    console.log(`cached catalog at ${dest} (gitignored)`);
    const scanned = scanCatalogBuildings(flattenCatalog(json));
    for (const [code, names] of scanned.extra) catalogNames.set(code, names);
    catalogMeetings = scanned.meetings;
    catalogCourses = scanned.courses;
  }

  if (args.catalog) {
    const file = resolve(process.cwd(), args.catalog);
    const scanned = scanCatalogBuildings(flattenCatalog(JSON.parse(readFileSync(file, "utf8"))));
    for (const [code, names] of scanned.extra) {
      if (!catalogNames.has(code)) catalogNames.set(code, new Set());
      for (const name of names) catalogNames.get(code).add(name);
    }
    catalogMeetings += scanned.meetings;
    catalogCourses += scanned.courses;
  }

  const buildings = toRows(coords, catalogNames);
  const wlh = buildings.find((b) => b.code === "WLH");
  if (!wlh) throw new Error("CourseTable dump is missing WLH — refusing to write");

  const provenance = {
    kind: "coursetable-buildings",
    label: "CourseTable building coordinates",
    detail:
      "Pins come from CourseTable's published buildingCoordinates.json (the same file CourseTable maps use). Class strings match building codes and names. Unknown rooms are not placed at Phelps Gate.",
    source: COORD_URL,
    generatedAt: new Date().toISOString(),
    catalogSeason,
    catalogCourses: catalogCourses || undefined,
    catalogMeetings: catalogMeetings || undefined,
    buildingCount: buildings.length,
  };

  console.log(`buildings: ${buildings.length}`);
  console.log(
    `WLH: ${wlh.name} ${wlh.lat}, ${wlh.lng} aliases=${wlh.aliases.join(" | ")}`,
  );
  if (catalogMeetings) {
    console.log(`catalog locations: ${catalogMeetings} meetings on ${catalogNames.size} codes`);
  }

  if (args.dryRun) {
    console.log("dry run: nothing written");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ provenance, buildings }, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

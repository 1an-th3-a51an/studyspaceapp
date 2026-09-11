#!/usr/bin/env node
/**
 * One-shot import of reservable Yale Library spaces from schedule.yale.edu.
 *
 * This is an offline snapshot generator — not a live availability scrape, and
 * it is never called from the Rooms UI. It walks LibCal location/category
 * pages, then each space page, and writes lib/data/libcalSpaces.json.
 *
 *   node scripts/import-libcal-spaces.mjs
 *   node scripts/import-libcal-spaces.mjs --dry-run
 *
 * Capacities are copied only when the space page publishes `Capacity: N`.
 * Rooms without a published number are stored as unknown — never invented.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../lib/data/libcalSpaces.json");

const BASE = "https://schedule.yale.edu";
const UA = "StudySpaceImport/1.0 (one-shot listing snapshot; not a live booking scrape)";

/** Building-level points for walking estimates. Not per-room surveyed coords. */
const LOCATIONS = {
  9058: {
    name: "Bass Library",
    address: "110 Wall St",
    lat: 41.3109,
    lng: -72.928,
    coordSource: "building",
  },
  9059: {
    name: "Marx Science and Social Science Library",
    address: "219 Prospect St",
    lat: 41.31724,
    lng: -72.92255,
    coordSource: "building",
  },
  9060: {
    name: "Sterling Memorial Library",
    address: "120 High St",
    lat: 41.31146,
    lng: -72.92894,
    coordSource: "building",
  },
  5726: {
    name: "Haas Family Arts Library",
    address: "180 York St",
    lat: 41.30877,
    lng: -72.93189,
    coordSource: "building",
  },
  14618: {
    name: "17 Hillhouse Avenue",
    address: "17 Hillhouse Ave",
    lat: 41.31276,
    lng: -72.92346,
    coordSource: "building",
  },
  13925: {
    name: "Yale Film Archive",
    address: "53 Wall St",
    lat: 41.3104,
    lng: -72.9272,
    coordSource: "building",
  },
  16864: {
    name: "Rosenkranz Hall",
    address: "125 Prospect St",
    lat: 41.31385,
    lng: -72.92355,
    coordSource: "building",
  },
};

/** Categories students can book. Staff-only / research terminals are omitted. */
const CATEGORIES = [
  { lid: 9058, gid: 9991, name: "Bass Library Group Study Rooms" },
  { lid: 9058, gid: 32401, name: "Individual Study Rooms - Courtyard Level" },
  { lid: 9058, gid: 39518, name: "Bass Library - Thain Café" },
  { lid: 9059, gid: 9990, name: "Marx Library Study Spaces" },
  { lid: 9059, gid: 9985, name: "Marx Library Classroom" },
  { lid: 9060, gid: 9986, name: "Sterling Memorial Library" },
  { lid: 5726, gid: 10012, name: "Arts Library Group Study Rooms" },
  { lid: 14618, gid: 30479, name: "17 Hillhouse Classroom" },
  { lid: 13925, gid: 28795, name: "Research Screening Room" },
  { lid: 13925, gid: 39313, name: "Viewing Booth A" },
  { lid: 13925, gid: 28796, name: "Viewing Booth B" },
  { lid: 13925, gid: 39314, name: "Viewing Booth C" },
  { lid: 16864, gid: 35696, name: "Rosenkranz Hall Classroom" },
];

function parseArgs(argv) {
  const out = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("usage: node scripts/import-libcal-spaces.mjs [--dry-run]");
      process.exit(0);
    } else {
      console.error(`unknown argument "${arg}"`);
      process.exit(1);
    }
  }
  return out;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function uniqueNumbers(html, re) {
  return Array.from(
    new Set(Array.from(html.matchAll(re), (m) => Number(m[1])).filter((n) => Number.isFinite(n))),
  );
}

function parseSpacePage(html, spaceId) {
  const titleMatch = html.match(
    /Space Availability\s*-\s*([^<]+?)\s*-\s*Yale Library/i,
  );
  const name = titleMatch
    ? titleMatch[1].replace(/\s+/g, " ").trim()
    : `LibCal space ${spaceId}`;
  const capMatch = html.match(/Capacity[:\s]*(\d+)/i);
  const capacity = capMatch ? Number(capMatch[1]) : undefined;
  return {
    name,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
  };
}

function inferKind(categoryName) {
  return /caf[eé]|coffee/i.test(categoryName) ? "coffee" : "room";
}

function inferTags(locationName, categoryName) {
  const tags = new Set(["reservable", "yale library"]);
  const blob = `${locationName} ${categoryName}`.toLowerCase();
  if (/group study|classroom/.test(blob)) tags.add("group");
  if (/individual|booth/.test(blob)) tags.add("solo");
  if (/individual|quiet/.test(blob)) tags.add("quiet");
  if (/caf[eé]/.test(blob)) {
    tags.add("coffee");
    tags.add("food");
  }
  if (/bass/.test(blob)) {
    tags.add("bass");
    tags.add("central campus");
  }
  if (/marx/.test(blob)) tags.add("science hill");
  if (/sterling/.test(blob)) tags.add("sterling");
  if (/arts|haas/.test(blob)) tags.add("arts");
  if (/film|screening|booth/.test(blob)) tags.add("media");
  if (/hillhouse/.test(blob)) tags.add("science hill");
  if (/rosenkranz/.test(blob)) tags.add("rosenkranz");
  if (/accessible|ada|courtyard/.test(blob)) tags.add("accessible");
  return Array.from(tags);
}

function slug(spaceId, name) {
  const extra = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return extra ? `libcal-${spaceId}-${extra}` : `libcal-${spaceId}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seen = new Map();

  for (const category of CATEGORIES) {
    const loc = LOCATIONS[category.lid];
    if (!loc) {
      console.warn(`skip category ${category.gid}: unknown lid ${category.lid}`);
      continue;
    }
    const listUrl = `${BASE}/spaces?lid=${category.lid}&gid=${category.gid}`;
    console.log(`listing ${category.name} (${listUrl})`);
    const html = await fetchText(listUrl);
    const spaceIds = uniqueNumbers(html, /\/space\/(\d+)/g);
    if (spaceIds.length === 0) {
      console.warn(`  no space ids found`);
      continue;
    }
    for (const spaceId of spaceIds) {
      if (seen.has(spaceId)) continue;
      const pageUrl = `${BASE}/space/${spaceId}`;
      const page = await fetchText(pageUrl);
      const parsed = parseSpacePage(page, spaceId);
      const kind = inferKind(category.name);
      const capacityKnown = typeof parsed.capacity === "number";
      seen.set(spaceId, {
        id: slug(spaceId, parsed.name),
        kind,
        name: parsed.name,
        address: loc.address,
        locationName: loc.name,
        categoryName: category.name,
        lat: loc.lat,
        lng: loc.lng,
        coordSource: loc.coordSource,
        bookingUrl: pageUrl,
        libcalSpaceId: spaceId,
        libcalLabel: parsed.name,
        libcalLid: category.lid,
        libcalGid: category.gid,
        ...(capacityKnown
          ? { capacity: parsed.capacity, capacitySource: "schedule.yale.edu" }
          : { capacitySource: "unknown" }),
        description: capacityKnown
          ? `Reservable ${category.name.toLowerCase()} at ${loc.name}. Yale publishes ${parsed.capacity} seat${parsed.capacity === 1 ? "" : "s"} on schedule.yale.edu.`
          : `Reservable ${category.name.toLowerCase()} at ${loc.name}. Seat count is not published on the space page.`,
        tags: inferTags(loc.name, category.name),
      });
      console.log(
        `  ${parsed.name} (#${spaceId}) ${capacityKnown ? `capacity ${parsed.capacity}` : "capacity unknown"}`,
      );
    }
  }

  const spaces = Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const withCapacity = spaces.filter((s) => s.capacitySource === "schedule.yale.edu").length;

  const snapshot = {
    provenance: {
      source: "schedule.yale.edu",
      label: "Yale LibCal space listings",
      detail:
        "Names, space ids, and capacities copied from public schedule.yale.edu location and space pages. Coordinates are the building, not a surveyed room entrance. This snapshot is not live availability.",
      generatedAt: new Date().toISOString(),
      spaceCount: spaces.length,
      publishedCapacityCount: withCapacity,
    },
    spaces,
  };

  console.log(
    `snapshot: ${spaces.length} spaces, ${withCapacity} with published capacity`,
  );

  if (args.dryRun) {
    console.log("dry run: nothing written");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Build lib/data/courseGraph.json from a CourseTable export.
 *
 *   node scripts/import-coursetable.mjs --fetch 202603 --term "Fall 2026"
 *   node scripts/import-coursetable.mjs --coenrollment path/to/coenrollment.csv
 *   node scripts/import-coursetable.mjs --catalog path/to/courses.json
 *
 * Two different kinds of input, because CourseTable exposes them differently.
 *
 * --fetch downloads the public catalog JSON CourseTable publishes at
 *   https://api.coursetable.com/api/catalog/public/{season}
 *   Season codes: YYYY + 01 spring / 02 summer / 03 fall. This is catalog
 *   adjacency (cross-listings, subject, level), not counted roster overlap.
 *
 * --coenrollment expects counted overlap, which is the signal the UI really
 *   wants ("46% of S&DS 2380 students also took MATH 2220"). CourseTable does
 *   not publish this, so it has to come from a registrar or survey export. CSV
 *   with a header row and these columns in any order:
 *
 *     course_a,course_b,students_a,students_both
 *     S&DS 2380,MATH 2220,142,48
 *
 *   `share` is students_both / students_a. A `share` column may be given
 *   directly instead of the two counts.
 *
 * --catalog expects a CourseTable/Ferry catalog dump: a JSON array of listing
 *   objects, or the public catalog shape (courses with nested `listings`).
 *
 * Everything is written with explicit provenance so the app can tell the user
 * where a link came from.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../lib/data/courseGraph.json");
const FIXTURE_DIR = resolve(HERE, "fixtures");

/** Keep the graph small: the UI shows at most a handful per course. */
const MAX_EDGES_PER_COURSE = 8;
/** Below this, an edge is noise rather than a study-buddy signal. */
const MIN_SHARE = 0.05;
/** Public catalog seasons: YYYY + 01 spring / 02 summer / 03 fall. */
const DEFAULT_SEASON = "202603";

const CODE_RE = /^([A-Z]{1,4}(?:&[A-Z]{1,4})?)\s*-?\s*(\d{3,4}[A-Z]?)$/;

function usage(message) {
  if (message) console.error(`\nerror: ${message}`);
  console.error(`
usage: node scripts/import-coursetable.mjs [options]

  --fetch [season]           Download CourseTable's public catalog (default ${DEFAULT_SEASON})
  --coenrollment <file.csv>  Counted co-enrollment overlap (preferred when you have it)
  --catalog <file.json>      CourseTable / Ferry catalog dump already on disk
  --term <label>             Term label recorded in provenance, e.g. "Fall 2026"
  --dry-run                  Print a summary without writing the file
`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const out = { dryRun: false, fetch: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage();
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--coenrollment") out.coenrollment = argv[++i];
    else if (arg === "--catalog") out.catalog = argv[++i];
    else if (arg === "--term") out.term = argv[++i];
    else if (arg === "--fetch") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out.fetch = next;
        i += 1;
      } else {
        out.fetch = DEFAULT_SEASON;
      }
    } else usage(`unknown argument "${arg}"`);
  }
  if (!out.coenrollment && !out.catalog && !out.fetch) {
    usage("pass --fetch, --coenrollment, and/or --catalog");
  }
  return out;
}

function seasonLabel(season) {
  if (!/^\d{6}$/.test(season)) return null;
  const year = season.slice(0, 4);
  const term = season.slice(4);
  if (term === "01") return `Spring ${year}`;
  if (term === "02") return `Summer ${year}`;
  if (term === "03") return `Fall ${year}`;
  return null;
}

/** "s&ds 238" and "SDS-2380" both normalise, or the row is rejected. */
function normaliseCode(input) {
  if (typeof input !== "string") return null;
  const cleaned = input.toUpperCase().replace(/&AMP;/g, "&").replace(/\s+/g, " ").trim();
  const match = cleaned.match(CODE_RE);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

/** Minimal RFC 4180 reader: quoted fields, embedded commas, CRLF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function csvRecords(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row");
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((cells) =>
    Object.fromEntries(header.map((key, i) => [key, (cells[i] ?? "").trim()])),
  );
}

function readCoEnrollment(file) {
  const records = csvRecords(readFileSync(file, "utf8"));
  const edges = new Map();
  const skipped = [];

  for (const [index, record] of records.entries()) {
    const a = normaliseCode(record.course_a ?? record.course ?? record.from);
    const b = normaliseCode(record.course_b ?? record.also_took ?? record.to);
    if (!a || !b) {
      skipped.push(`row ${index + 2}: unrecognised course code`);
      continue;
    }
    if (a === b) continue;

    let share = Number(record.share);
    if (!Number.isFinite(share)) {
      const both = Number(record.students_both ?? record.both ?? record.overlap);
      const total = Number(record.students_a ?? record.total ?? record.enrollment_a);
      if (!Number.isFinite(both) || !Number.isFinite(total) || total <= 0) {
        skipped.push(`row ${index + 2}: no usable share or counts`);
        continue;
      }
      share = both / total;
    }
    if (share <= 0 || share > 1) {
      skipped.push(`row ${index + 2}: share ${share} outside (0, 1]`);
      continue;
    }
    if (share < MIN_SHARE) continue;

    if (!edges.has(a)) edges.set(a, new Map());
    const existing = edges.get(a).get(b);
    edges.get(a).set(b, existing === undefined ? share : Math.max(existing, share));
  }

  return { edges, skipped, rows: records.length };
}

/**
 * Flatten one catalog record into listing rows.
 *
 * CourseTable's public JSON is an array of courses, each with nested
 * `listings` (subject/number/school plus cross-listings). Older Ferry dumps
 * are a flat array of listing objects instead.
 */
function flattenListings(parsed) {
  const records = Array.isArray(parsed)
    ? parsed
    : (parsed.listings ?? parsed.courses ?? parsed.data ?? []);
  if (!Array.isArray(records)) {
    throw new Error("catalog JSON must be an array, or an object with a listings/courses/data array");
  }

  const out = [];
  for (const entry of records) {
    const nested = Array.isArray(entry.listings) ? entry.listings : null;
    if (nested && nested.length > 0) {
      for (const listing of nested) {
        out.push({
          subject: listing.subject ?? listing.subject_code ?? listing.dept,
          number: listing.number ?? listing.course_number ?? listing.catalog_number,
          course_code: listing.course_code,
          school: listing.school,
          title: entry.title ?? listing.title,
          same_course_id: entry.same_course_id ?? entry.course_id ?? listing.same_course_id,
          areas: entry.areas ?? listing.areas ?? [],
          skills: entry.skills ?? listing.skills ?? [],
        });
      }
      continue;
    }
    out.push(entry);
  }
  return out;
}

function readCatalogData(listings) {
  const titles = {};
  const sameCourse = new Map();
  const byTag = new Map();
  const subjects = new Map();
  const schools = new Map();

  for (const listing of listings) {
    const fromCode = listing.course_code ? normaliseCode(listing.course_code) : null;
    const subject = listing.subject ?? listing.subject_code ?? listing.dept;
    const number = listing.number ?? listing.course_number ?? listing.catalog_number;
    const code = fromCode ?? normaliseCode(`${subject ?? ""} ${number ?? ""}`);
    if (!code) continue;

    const title = (listing.title ?? listing.course?.title ?? "").trim();
    if (title) titles[code] = title;

    const groupId = listing.same_course_id ?? listing.course_id ?? listing.same_course_and_profs_id;
    if (groupId !== undefined && groupId !== null) {
      const key = String(groupId);
      if (!sameCourse.has(key)) sameCourse.set(key, new Set());
      sameCourse.get(key).add(code);
    }

    for (const tag of [...(listing.areas ?? []), ...(listing.skills ?? [])]) {
      const key = String(tag);
      if (!byTag.has(key)) byTag.set(key, new Set());
      byTag.get(key).add(code);
    }

    const match = code.match(CODE_RE);
    if (!match) continue;
    const [, subj, num] = match;
    const level = num[0];
    const school = String(listing.school ?? "").toUpperCase();
    // Adjacency is most useful inside Yale College; graduate 3-digit codes
    // sharing a subject would otherwise glue every MUS 5xx together.
    if (school && school !== "YC") continue;
    const key = `${subj} ${level}`;
    if (!subjects.has(key)) subjects.set(key, new Set());
    subjects.get(key).add(code);
    schools.set(code, school || "YC");
  }

  const equivalence = [];
  for (const codes of sameCourse.values()) {
    if (codes.size < 2) continue;
    const list = Array.from(codes).sort();
    const topic = titles[list[0]] ?? "Cross-listed course";
    equivalence.push({ topic, courses: list });
  }

  const edges = new Map();
  const addEdge = (a, b, weight) => {
    if (a === b) return;
    if (!edges.has(a)) edges.set(a, new Map());
    const prev = edges.get(a).get(b) ?? 0;
    edges.get(a).set(b, Math.max(prev, weight));
  };
  for (const codes of subjects.values()) {
    const list = Array.from(codes);
    if (list.length > 40) continue;
    for (const a of list) for (const b of list) addEdge(a, b, 0.3);
  }
  for (const codes of byTag.values()) {
    const list = Array.from(codes);
    if (list.length > 40) continue;
    for (const a of list) for (const b of list) addEdge(a, b, 0.15);
  }

  return { edges, titles, equivalence, rows: listings.length, skipped: [] };
}

function readCatalog(file) {
  return readCatalogData(flattenListings(JSON.parse(readFileSync(file, "utf8"))));
}

async function fetchCatalog(season) {
  const url = `https://api.coursetable.com/api/catalog/public/${season}`;
  console.log(`fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CourseTable catalog ${url} returned ${res.status}`);
  }
  const json = await res.json();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const dest = resolve(FIXTURE_DIR, `catalog-${season}.json`);
  writeFileSync(dest, `${JSON.stringify(json)}\n`, "utf8");
  console.log(`cached catalog at ${dest}`);
  return readCatalogData(flattenListings(json));
}

function trimEdges(edges) {
  const out = {};
  let edgeCount = 0;
  for (const [code, targets] of edges) {
    const top = Array.from(targets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_EDGES_PER_COURSE);
    if (top.length === 0) continue;
    out[code] = Object.fromEntries(
      top.map(([target, share]) => [target, Math.round(share * 1000) / 1000]),
    );
    edgeCount += top.length;
  }
  return { coEnrollment: out, edgeCount };
}

function readExistingGraph() {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return { equivalence: [], titles: {} };
  }
}

function mergeEquivalence(primary, fallback) {
  const seen = new Set();
  const out = [];
  for (const group of [...primary, ...fallback]) {
    const courses = Array.from(new Set(group.courses ?? [])).sort();
    if (courses.length < 2) continue;
    const key = courses.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ topic: group.topic || "Cross-listed course", courses });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const existing = readExistingGraph();

  let edges = new Map();
  let titles = {};
  let equivalence = [];
  const skipped = [];
  let kind;
  let term = args.term ?? null;

  if (args.fetch) {
    const catalog = await fetchCatalog(args.fetch);
    edges = catalog.edges;
    titles = catalog.titles;
    equivalence = catalog.equivalence;
    kind = "coursetable-catalog";
    term = term ?? seasonLabel(args.fetch);
    console.log(`catalog: ${catalog.rows} listings, ${Object.keys(titles).length} titles`);
  }

  if (args.catalog) {
    const catalog = readCatalog(resolve(process.cwd(), args.catalog));
    edges = catalog.edges;
    titles = catalog.titles;
    equivalence = catalog.equivalence;
    kind = "coursetable-catalog";
    console.log(`catalog: ${catalog.rows} listings, ${Object.keys(titles).length} titles`);
  }

  if (args.coenrollment) {
    const counted = readCoEnrollment(resolve(process.cwd(), args.coenrollment));
    edges = counted.edges;
    skipped.push(...counted.skipped);
    kind = "coursetable-coenrollment";
    console.log(`co-enrollment: ${counted.rows} rows, ${counted.edges.size} source courses`);
  }

  // Cross-listings from this term plus the curated intro-track groups (linear
  // algebra, intro micro, …) which the catalog cannot invent because nobody
  // takes two of them.
  equivalence = mergeEquivalence(equivalence, existing.equivalence ?? []);
  if (Object.keys(titles).length === 0) titles = existing.titles ?? {};

  const { coEnrollment, edgeCount } = trimEdges(edges);
  const courseCount = Object.keys(coEnrollment).length;

  if (courseCount === 0) {
    console.error("error: no usable edges were produced; refusing to overwrite the graph");
    process.exit(1);
  }

  const provenance = {
    kind,
    label:
      kind === "coursetable-coenrollment"
        ? `CourseTable co-enrollment${term ? ` · ${term}` : ""}`
        : `CourseTable catalog${term ? ` · ${term}` : ""}`,
    detail:
      kind === "coursetable-coenrollment"
        ? "Shares are counted overlap between class rosters from a CourseTable export."
        : "Links are catalog adjacency (same subject, level, area, or cross-listing), not measured enrollment overlap.",
    generatedAt: new Date().toISOString(),
    termLabel: term,
    courseCount,
    edgeCount,
  };

  const graph = { provenance, equivalence, coEnrollment, titles };

  if (skipped.length > 0) {
    console.warn(`skipped ${skipped.length} row(s):`);
    for (const line of skipped.slice(0, 20)) console.warn(`  ${line}`);
    if (skipped.length > 20) console.warn(`  … and ${skipped.length - 20} more`);
  }

  console.log(
    `graph: ${courseCount} courses, ${edgeCount} edges, ${equivalence.length} equivalence group(s)`,
  );

  if (args.dryRun) {
    console.log("dry run: nothing written");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

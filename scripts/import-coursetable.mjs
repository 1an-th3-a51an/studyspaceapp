#!/usr/bin/env node
/**
 * Build lib/data/courseGraph.json from a CourseTable catalog export.
 *
 *   node scripts/import-coursetable.mjs --catalog scripts/fixtures/catalog-202603.json --term "Fall 2026"
 *   node scripts/import-coursetable.mjs --fetch 202603 --term "Fall 2026"
 *
 * --fetch downloads the public catalog JSON CourseTable publishes at
 *   https://api.coursetable.com/api/catalog/public/{season}
 *   Season codes: YYYY + 01 spring / 02 summer / 03 fall.
 *
 * Similar-course edges are lexical overlap of catalog **descriptions** (and
 * titles), not subject-neighbor adjacency and not co-enrollment. Cross-listings
 * from `same_course_id` stay as equivalence groups.
 *
 * --catalog expects a CourseTable/Ferry catalog dump: a JSON array of listing
 *   objects, or the public catalog shape (courses with nested `listings`).
 *
 * Descriptions are written to lib/data/courseDescriptions.json so the client
 * bundle does not ship every catalog paragraph.
 *
 * Building pins for the Rooms map come from CourseTable's
 * buildingCoordinates.json via `npm run import:coursetable:buildings`.
 *
 * Everything is written with explicit provenance so the app can tell the user
 * where a link came from.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../lib/data/courseGraph.json");
const DESC_OUT = resolve(HERE, "../lib/data/courseDescriptions.json");
const FIXTURE_DIR = resolve(HERE, "fixtures");

/** Keep the graph small: the UI shows at most a handful per course. */
const MAX_EDGES_PER_COURSE = 8;
/** Below this cosine, description overlap is noise rather than a study-buddy signal. */
const MIN_COSINE = 0.18;
/** Ignore pairs that share only a couple of tokens. */
const MIN_SHARED_TOKENS = 5;
/** Public catalog seasons: YYYY + 01 spring / 02 summer / 03 fall. */
const DEFAULT_SEASON = "202603";

const CODE_RE = /^([A-Z]{1,4}(?:&[A-Z]{1,4})?)\s*-?\s*(\d{3,4}[A-Z]?)$/;

function usage(message) {
  if (message) console.error(`\nerror: ${message}`);
  console.error(`
usage: node scripts/import-coursetable.mjs [options]

  --fetch [season]           Download CourseTable's public catalog (default ${DEFAULT_SEASON})
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
  if (!out.catalog && !out.fetch) {
    usage("pass --fetch and/or --catalog");
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
          description: entry.description ?? listing.description ?? "",
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

const DESC_STOP = new Set([
  "the", "and", "for", "that", "this", "with", "from", "are", "was", "were",
  "will", "can", "may", "not", "but", "its", "their", "they", "them", "who",
  "how", "what", "when", "which", "into", "than", "also", "such", "these",
  "those", "have", "has", "had", "been", "being", "does", "did", "course",
  "courses", "students", "student", "including", "include", "includes",
  "introduction", "introductory", "seminar", "lecture", "discussion",
  "required", "enrollment", "credit", "credits", "yale", "college", "fall",
  "spring", "instructor", "permission", "prerequisite", "prerequisites",
  "offered", "topics", "focus", "examines", "examine", "explore", "explores",
  "weekly", "reading", "readings", "assignment", "assignments", "about",
  "through", "between", "within", "using", "used", "well", "both", "each",
  "other", "more", "most", "some", "any", "all", "one", "two", "three",
  "first", "second", "year", "term", "class", "classes", "work", "works",
]);

function tokenizeDescription(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !DESC_STOP.has(t)),
  );
}

function sharedCount(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function idfCosine(a, b, idf) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const t of a) {
    const w = idf.get(t) ?? 0;
    na += w * w;
    if (b.has(t)) dot += w * w;
  }
  for (const t of b) {
    const w = idf.get(t) ?? 0;
    nb += w * w;
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

/** Lexical overlap of catalog descriptions. Inverted index keeps it O(tokens). */
function descriptionEdges(documents) {
  const tokensByCode = new Map();
  const postings = new Map();
  for (const [code, text] of Object.entries(documents)) {
    const tokens = tokenizeDescription(text);
    if (tokens.size < 4) continue;
    tokensByCode.set(code, tokens);
    for (const token of tokens) {
      if (!postings.has(token)) postings.set(token, new Set());
      postings.get(token).add(code);
    }
  }

  const nDocs = tokensByCode.size;
  const idf = new Map();
  for (const [token, posting] of postings) {
    idf.set(token, Math.log((1 + nDocs) / (1 + posting.size)) + 1);
  }

  const edges = new Map();
  for (const [code, tokens] of tokensByCode) {
    const candidates = new Set();
    for (const token of tokens) {
      const posting = postings.get(token);
      if (!posting) continue;
      for (const other of posting) {
        if (other !== code) candidates.add(other);
      }
    }
    const scored = [];
    for (const other of candidates) {
      const theirs = tokensByCode.get(other);
      if (!theirs || sharedCount(tokens, theirs) < MIN_SHARED_TOKENS) continue;
      const score = idfCosine(tokens, theirs, idf);
      if (score >= MIN_COSINE) scored.push([other, score]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    if (scored.length === 0) continue;
    edges.set(code, new Map(scored.slice(0, MAX_EDGES_PER_COURSE)));
  }
  return edges;
}

function readCatalogData(listings) {
  const titles = {};
  const descriptions = {};
  const sameCourse = new Map();
  const documents = {};

  for (const listing of listings) {
    const fromCode = listing.course_code ? normaliseCode(listing.course_code) : null;
    const subject = listing.subject ?? listing.subject_code ?? listing.dept;
    const number = listing.number ?? listing.course_number ?? listing.catalog_number;
    const code = fromCode ?? normaliseCode(`${subject ?? ""} ${number ?? ""}`);
    if (!code) continue;

    const title = (listing.title ?? listing.course?.title ?? "").trim();
    if (title) titles[code] = title;

    const description = String(listing.description ?? listing.course?.description ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (description) descriptions[code] = description;

    documents[code] = `${title}. ${description}`.trim();

    const groupId = listing.same_course_id ?? listing.course_id ?? listing.same_course_and_profs_id;
    if (groupId !== undefined && groupId !== null) {
      const key = String(groupId);
      if (!sameCourse.has(key)) sameCourse.set(key, new Set());
      sameCourse.get(key).add(code);
    }
  }

  const equivalence = [];
  for (const codes of sameCourse.values()) {
    if (codes.size < 2) continue;
    const list = Array.from(codes).sort();
    const topic = titles[list[0]] ?? "Cross-listed course";
    equivalence.push({ topic, courses: list });
  }

  const edges = descriptionEdges(documents);
  return {
    edges,
    titles,
    descriptions,
    equivalence,
    rows: listings.length,
    skipped: [],
  };
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
  return { descriptionSimilarity: out, edgeCount };
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
  let descriptions = {};
  let equivalence = [];
  const skipped = [];
  let term = args.term ?? null;

  if (args.fetch) {
    const catalog = await fetchCatalog(args.fetch);
    edges = catalog.edges;
    titles = catalog.titles;
    descriptions = catalog.descriptions ?? {};
    equivalence = catalog.equivalence;
    term = term ?? seasonLabel(args.fetch);
    console.log(
      `catalog: ${catalog.rows} listings, ${Object.keys(titles).length} titles, ${Object.keys(descriptions).length} descriptions`,
    );
  }

  if (args.catalog) {
    const catalog = readCatalog(resolve(process.cwd(), args.catalog));
    edges = catalog.edges;
    titles = catalog.titles;
    descriptions = catalog.descriptions ?? {};
    equivalence = catalog.equivalence;
    console.log(
      `catalog: ${catalog.rows} listings, ${Object.keys(titles).length} titles, ${Object.keys(descriptions).length} descriptions`,
    );
  }

  // Cross-listings from this term. Do not invent extra "also-took" neighbors.
  equivalence = mergeEquivalence(equivalence, existing.equivalence ?? []);
  if (Object.keys(titles).length === 0) titles = existing.titles ?? {};

  const { descriptionSimilarity, edgeCount } = trimEdges(edges);
  const courseCount = Object.keys(descriptionSimilarity).length;

  if (courseCount === 0) {
    console.error("error: no usable description-overlap edges; refusing to overwrite the graph");
    process.exit(1);
  }

  for (const sample of ["CHEM 1610", "S&DS 2380", "AMST 1197"]) {
    const neighbors = descriptionSimilarity[sample];
    if (neighbors) {
      console.log(
        `${sample} neighbors: ${Object.entries(neighbors)
          .map(([code, score]) => `${code} ${score}`)
          .join(", ")}`,
      );
    } else {
      console.log(`${sample} neighbors: (none)`);
    }
  }

  const provenance = {
    kind: "coursetable-descriptions",
    label: `CourseTable catalog descriptions${term ? ` · ${term}` : ""}`,
    detail:
      "Similar courses share overlapping CourseTable catalog descriptions (token overlap). This is not co-enrollment or measured roster overlap. Cross-listings are same CourseTable listing.",
    generatedAt: new Date().toISOString(),
    termLabel: term,
    courseCount,
    edgeCount,
  };

  const graph = { provenance, equivalence, descriptionSimilarity, titles };

  if (skipped.length > 0) {
    console.warn(`skipped ${skipped.length} row(s):`);
    for (const line of skipped.slice(0, 20)) console.warn(`  ${line}`);
    if (skipped.length > 20) console.warn(`  … and ${skipped.length - 20} more`);
  }

  console.log(
    `graph: ${courseCount} courses, ${edgeCount} edges, ${equivalence.length} equivalence group(s), ${Object.keys(descriptions).length} descriptions`,
  );

  if (args.dryRun) {
    console.log("dry run: nothing written");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  writeFileSync(
    DESC_OUT,
    `${JSON.stringify({ provenance: { ...provenance, file: "courseDescriptions" }, descriptions }, null, 2)}\n`,
    "utf8",
  );
  console.log(`wrote ${OUT}`);
  console.log(`wrote ${DESC_OUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

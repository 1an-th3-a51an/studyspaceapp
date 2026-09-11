import type { StudyRecommendation } from "@/lib/types";

/**
 * Natural-language search over study spots.
 *
 * Deterministic, dependency-free, and runs on the client or server. Terms are
 * stemmed lightly and expanded through a synonym table so "silent" finds
 * "quiet", "board" finds "whiteboard", etc. Scoring is BM25 over a document
 * built from name + description + tags + address, plus a capacity bonus when
 * the query mentions a group size.
 */

export type SpaceMatch = {
  spot: StudyRecommendation;
  /** 0..1, relative to the best match in this result set. */
  score: number;
  /** Query terms (after expansion) that hit this spot. */
  matchedTerms: string[];
  /** Group size parsed from the query, if any. */
  wantedCapacity?: number;
};

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "to", "for", "of", "in", "on", "at", "with",
  "i", "me", "my", "we", "our", "us", "you", "it", "is", "are", "be", "am", "was",
  "need", "needs", "want", "wants", "looking", "look", "find", "somewhere", "place",
  "spot", "room", "space", "study", "that", "this", "some", "any", "where", "can",
  "near", "nearby", "close", "please", "like", "would", "should", "have", "has",
  "people", "person", "ppl", "someone", "group", "of",
]);

// Group words are stopped above but re-added as concepts via synonyms when
// they carry meaning ("group" → collaborative). Keep the list small and obvious.
const SYNONYMS: Record<string, string[]> = {
  quiet: ["silent", "calm", "focus", "no talking"],
  silent: ["quiet", "focus", "no talking"],
  talk: ["discussion", "collaborative"],
  calm: ["quiet"],
  focus: ["quiet", "silent", "solo"],
  loud: ["social", "background noise", "busy"],
  noisy: ["loud", "background noise"],
  social: ["loud", "collaborative"],
  whiteboard: ["board", "markers"],
  board: ["whiteboard"],
  monitor: ["screen", "tv", "display", "hdmi"],
  screen: ["monitor"],
  tv: ["monitor"],
  outlet: ["power", "charger", "charging", "plug"],
  power: ["outlet"],
  charge: ["outlet"],
  charger: ["outlet"],
  plug: ["outlet"],
  coffee: ["cafe", "espresso", "latte", "caffeine"],
  cafe: ["coffee"],
  espresso: ["coffee"],
  caffeine: ["coffee"],
  tea: ["coffee"],
  food: ["snack", "lunch", "eat", "sandwich"],
  snack: ["food"],
  lunch: ["food"],
  eat: ["food"],
  team: ["group", "collaborative", "project"],
  collab: ["collaborative", "group"],
  collaborate: ["collaborative", "group"],
  together: ["group", "collaborative"],
  partner: ["group", "pair"],
  pair: ["group"],
  friends: ["group"],
  alone: ["solo"],
  solo: ["alone", "reading"],
  myself: ["solo"],
  reading: ["read", "book"],
  read: ["reading"],
  write: ["writing", "essay"],
  writing: ["essay"],
  essay: ["writing"],
  paper: ["writing", "essay"],
  code: ["coding", "laptop", "stem"],
  coding: ["code", "laptop"],
  programming: ["coding"],
  pset: ["problem set", "stem"],
  problem: ["problem set"],
  math: ["stem", "problem set"],
  science: ["stem", "science hill"],
  engineering: ["stem", "science hill", "makerspace"],
  build: ["makerspace", "prototyping", "project"],
  prototype: ["prototyping", "makerspace"],
  present: ["presentation", "monitor"],
  presentation: ["monitor", "group"],
  practice: ["presentation"],
  late: ["late night", "night"],
  night: ["late night"],
  overnight: ["late night"],
  window: ["natural light", "bright"],
  light: ["natural light", "bright"],
  sunny: ["natural light", "bright"],
  bright: ["natural light"],
  pretty: ["beautiful"],
  beautiful: ["pretty"],
  aesthetic: ["beautiful"],
  private: ["enclosed", "small"],
  enclosed: ["private"],
  book: ["reservable", "bookable"],
  reserve: ["reservable", "bookable"],
  bookable: ["reservable"],
  discussion: ["seminar", "talk"],
  seminar: ["discussion"],
  language: ["discussion", "conversation"],
  wifi: ["internet"],
  internet: ["wifi"],
  hill: ["science hill"],
  central: ["central campus"],
  campus: ["central campus"],
  bass: ["central campus"],
  sterling: ["silent"],
  kline: ["science hill"],
  davies: ["near davies", "engineering"],
  cozy: ["calm", "small"],
  big: ["large", "communal tables"],
  large: ["big"],
  small: ["cozy"],
  quick: ["short"],
  meeting: ["group", "discussion"],
};

function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Fold negations into one token so "no food" never matches "food".
    .replace(/\b(no|not|without)\s+([a-z]+)/g, "no_$2")
    .replace(/[^a-z0-9\s'_-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Expand query tokens through the synonym table. Multi-word synonyms are tokenized. */
export function expandQuery(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const raw of tokens) {
    out.add(raw);
    const syns = SYNONYMS[raw] ?? SYNONYMS[Object.keys(SYNONYMS).find((k) => stem(k) === raw) ?? ""];
    if (!syns) continue;
    for (const s of syns) {
      for (const st of tokenize(s)) out.add(st);
    }
  }
  return Array.from(out);
}

/** "for 6 people", "group of 4", "6 of us", "six people" → 6 */
export function parseWantedCapacity(query: string): number | undefined {
  const q = query.toLowerCase();
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  };
  const patterns = [
    /(\d{1,3})\s*(?:people|ppl|persons?|of us|students|friends|members)/,
    /(?:group|team|party|club)\s+of\s+(\d{1,3})/,
    /for\s+(\d{1,3})\b/,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m) return Number(m[1]);
  }
  const wordMatch = q.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s+(?:people|ppl|of us|students|friends)/,
  );
  if (wordMatch) return words[wordMatch[1]];
  if (/\b(alone|by myself|solo|just me)\b/.test(q)) return 1;
  return undefined;
}

function documentTokens(spot: StudyRecommendation): string[] {
  const parts = [
    spot.name,
    spot.name, // name counts double
    spot.description ?? "",
    (spot.tags ?? []).join(" "),
    (spot.tags ?? []).join(" "),
    spot.address ?? "",
    spot.kind === "coffee" ? "coffee cafe" : "room library bookable",
  ];
  return tokenize(parts.join(" "));
}

export function searchSpaces(
  query: string,
  spots: StudyRecommendation[],
): SpaceMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const wantedCapacity = parseWantedCapacity(trimmed);
  const queryTokens = expandQuery(tokenize(trimmed));
  if (queryTokens.length === 0 && wantedCapacity === undefined) return [];

  const docs = spots.map((spot) => {
    const tokens = documentTokens(spot);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { spot, tokens, tf };
  });
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, N);
  const df = new Map<string, number>();
  for (const term of queryTokens) {
    df.set(term, docs.filter((d) => d.tf.has(term)).length);
  }

  const k1 = 1.4;
  const b = 0.6;
  const raw = docs.map(({ spot, tokens, tf }) => {
    let score = 0;
    const matched: string[] = [];
    for (const term of queryTokens) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const norm = f * (k1 + 1) / (f + k1 * (1 - b + (b * tokens.length) / avgLen));
      score += idf * norm;
      matched.push(term);
    }
    if (wantedCapacity !== undefined && typeof spot.capacity === "number") {
      if (spot.capacity >= wantedCapacity) {
        score += 1.0;
      } else {
        // Too small: heavy penalty scaled by how far off it is.
        score -= 1.5 * Math.min(1, (wantedCapacity - spot.capacity) / wantedCapacity) + 0.5;
      }
    }
    return { spot, score, matchedTerms: matched, wantedCapacity };
  });

  const best = Math.max(...raw.map((r) => r.score), 0);
  return raw
    .filter((r) =>
      queryTokens.length > 0
        ? r.matchedTerms.length > 0
        : wantedCapacity !== undefined && r.score > 0,
    )
    .map((r) => ({ ...r, score: best > 0 ? Math.max(0, r.score) / best : 0 }))
    .sort((a, b2) => b2.score - a.score || a.spot.name.localeCompare(b2.spot.name));
}

/** Human-readable tags on the spot that the query actually hit. */
export function matchedTags(match: SpaceMatch): string[] {
  const hits = new Set(match.matchedTerms);
  const out: string[] = [];
  for (const tag of match.spot.tags ?? []) {
    const toks = tokenize(tag);
    if (toks.length > 0 && toks.every((t) => hits.has(t))) out.push(tag);
  }
  return out.slice(0, 6);
}

/**
 * "Similar course" logic for study pools.
 *
 * Two signals, combined:
 *
 * 1. Equivalence groups — hand-curated sets of alternative tracks that cover
 *    the same material (MATH 2220 / 2250 / 2260 are all linear algebra). Nobody
 *    takes two of these, so co-enrollment data can never link them; they have
 *    to be declared.
 *
 * 2. Co-enrollment — CourseTable's "students who took this class also took…"
 *    signal. Seeded here as a static sample until a CourseTable export is
 *    wired in; every entry is labeled as sample data in the UI.
 *
 * Course numbers are Yale College's four-digit catalog codes (S&DS 2380, not
 * 238). See README for why the demo graph looks the way it does.
 */

export type SimilarityReason = "equivalent" | "also-took";

export type SimilarCourse = {
  courseCode: string;
  reason: SimilarityReason;
  /** 1 for equivalents; co-enrollment share (0..1) for "also took". */
  weight: number;
  /** Short human explanation shown as a chip. */
  label: string;
};

/**
 * Dept letters, optional & (S&DS), then a 4-digit number. 3-digit is only a
 * fallback so an old .ics still round-trips; canonical form is 4 digits.
 */
const COURSE_CODE_FOUR = /([A-Z]{1,4}(?:&[A-Z]{1,4})?)\s*-?\s*(\d{4}[A-Z]?)/i;
const COURSE_CODE_THREE = /([A-Z]{1,4}(?:&[A-Z]{1,4})?)\s*-?\s*(\d{3}[A-Z]?)/i;

export const CANONICAL_COURSE_CODE_RE =
  /^[A-Z]{1,4}(?:&[A-Z]{1,4})? \d{4}[A-Z]?$/;

function prep(input: string): string {
  return input.toUpperCase().replace(/&AMP;/g, "&");
}

function formatCode(dept: string, num: string): string {
  return `${dept.toUpperCase()} ${num.toUpperCase()}`;
}

/** Pull "S&DS 2380" out of a SUMMARY, syllabus line, etc. */
export function extractCourseCode(input: string): string {
  const text = prep(input);
  const four = text.match(COURSE_CODE_FOUR);
  if (four) return formatCode(four[1], four[2]);
  const three = text.match(COURSE_CODE_THREE);
  if (three) return formatCode(three[1], three[2]);
  return "UNKNOWN";
}

export function normalizeCourseCode(input: string): string {
  const extracted = extractCourseCode(input);
  return extracted === "UNKNOWN" ? input.trim().toUpperCase() : extracted;
}

export function isCanonicalCourseCode(input: string): boolean {
  return CANONICAL_COURSE_CODE_RE.test(normalizeCourseCode(input));
}

/** Alternative tracks for the same material. Four-digit Yale College codes. */
export const EQUIVALENCE_GROUPS: { topic: string; courses: string[] }[] = [
  { topic: "Linear algebra", courses: ["MATH 2220", "MATH 2250", "MATH 2260"] },
  { topic: "Multivariable calculus", courses: ["MATH 1180", "MATH 1200"] },
  { topic: "Intro programming", courses: ["CPSC 1000", "CPSC 1100"] },
  { topic: "Intro microeconomics", courses: ["ECON 1080", "ECON 1100", "ECON 1150"] },
  { topic: "Intro macroeconomics", courses: ["ECON 1110", "ECON 1160"] },
  { topic: "Intro mechanics", courses: ["PHYS 1700", "PHYS 1800", "PHYS 2000"] },
  { topic: "Intro E&M", courses: ["PHYS 1710", "PHYS 1810", "PHYS 2010"] },
  { topic: "General chemistry", courses: ["CHEM 1610", "CHEM 1650"] },
];

/**
 * Seeded co-enrollment sample: for each course, courses its students also
 * took, with the share of students (0..1). Symmetric lookups are derived.
 * Source: [Demo Sample] — replace with a CourseTable export.
 */
export const CO_ENROLLMENT_SAMPLE: Record<string, Record<string, number>> = {
  "S&DS 2380": {
    "S&DS 2300": 0.46,
    "MATH 1200": 0.41,
    "MATH 2220": 0.34,
    "CPSC 2020": 0.27,
    "ECON 1350": 0.21,
  },
  "AMST 1197": {
    "HSAR 1100": 0.38,
    "ARCH 1500": 0.31,
    "HIST 1200": 0.27,
    "AMST 1110": 0.22,
  },
  "ASL 1100": {
    "LING 1100": 0.44,
    "CHNS 1100": 0.18,
    "SPAN 1100": 0.16,
    "FREN 1100": 0.14,
  },
  "MATH 2220": { "MATH 1200": 0.4, "PHYS 1800": 0.29, "S&DS 2380": 0.24 },
  "MATH 2250": { "MATH 2300": 0.4, "CPSC 2020": 0.31, "PHYS 2000": 0.2 },
  "CPSC 2230": { "CPSC 2020": 0.62, "MATH 2220": 0.41, "CPSC 3230": 0.35, "S&DS 2420": 0.22 },
  "CPSC 2020": { "CPSC 2230": 0.58, "MATH 2250": 0.3, "CPSC 2010": 0.27 },
  "ECON 1150": { "ECON 1160": 0.71, "MATH 1120": 0.38, "S&DS 1010": 0.3, "ECON 1170": 0.25 },
};

export function equivalentCourses(courseCode: string): { topic: string; courses: string[] } | null {
  const code = normalizeCourseCode(courseCode);
  const group = EQUIVALENCE_GROUPS.find((g) => g.courses.includes(code));
  if (!group) return null;
  return { topic: group.topic, courses: group.courses.filter((c) => c !== code) };
}

export function alsoTookCourses(courseCode: string): { courseCode: string; share: number }[] {
  const code = normalizeCourseCode(courseCode);
  const direct = CO_ENROLLMENT_SAMPLE[code] ?? {};
  const merged = new Map<string, number>(Object.entries(direct));
  // Reverse edges: if Y's students also took X, X's students plausibly overlap Y.
  for (const [other, links] of Object.entries(CO_ENROLLMENT_SAMPLE)) {
    if (other === code) continue;
    const share = links[code];
    if (typeof share === "number" && !merged.has(other)) merged.set(other, share * 0.8);
  }
  return Array.from(merged.entries())
    .map(([courseCode, share]) => ({ courseCode, share }))
    .sort((a, b) => b.share - a.share);
}

/** Equivalents first, then co-enrollment by share. Never includes the course itself. */
export function similarCourses(courseCode: string, limit = 6): SimilarCourse[] {
  const code = normalizeCourseCode(courseCode);
  const out: SimilarCourse[] = [];
  const seen = new Set<string>([code]);

  const eq = equivalentCourses(code);
  if (eq) {
    for (const c of eq.courses) {
      seen.add(c);
      out.push({
        courseCode: c,
        reason: "equivalent",
        weight: 1,
        label: `Same material: ${eq.topic.toLowerCase()}`,
      });
    }
  }

  for (const { courseCode: c, share } of alsoTookCourses(code)) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push({
      courseCode: c,
      reason: "also-took",
      weight: share,
      label: `${Math.round(share * 100)}% of ${code} students also took this`,
    });
  }

  return out.slice(0, limit);
}

/**
 * "Similar course" logic for study pools.
 *
 * Two signals, combined:
 *
 * 1. Equivalence groups — hand-curated sets of alternative tracks that cover
 *    the same material (MATH 222 / 225 / 226 are all linear algebra). Nobody
 *    takes two of these, so co-enrollment data can never link them; they have
 *    to be declared.
 *
 * 2. Co-enrollment — CourseTable's "students who took this class also took…"
 *    signal. Seeded here as a static sample until a CourseTable export is
 *    wired in; every entry is labeled as sample data in the UI.
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

export function normalizeCourseCode(input: string): string {
  const m = input
    .toUpperCase()
    .replace(/&AMP;/g, "&")
    .match(/([A-Z&]{2,5})\s*-?\s*(\d{3}[A-Z]?)/);
  return m ? `${m[1]} ${m[2]}` : input.trim().toUpperCase();
}

/** Alternative tracks for the same material. Extend freely. */
export const EQUIVALENCE_GROUPS: { topic: string; courses: string[] }[] = [
  { topic: "Linear algebra", courses: ["MATH 222", "MATH 225", "MATH 226"] },
  { topic: "Multivariable calculus", courses: ["MATH 118", "MATH 120"] },
  { topic: "Intro programming", courses: ["CPSC 100", "CPSC 112"] },
  { topic: "Intro microeconomics", courses: ["ECON 108", "ECON 110", "ECON 115"] },
  { topic: "Intro macroeconomics", courses: ["ECON 111", "ECON 116"] },
  { topic: "Intro mechanics", courses: ["PHYS 170", "PHYS 180", "PHYS 200"] },
  { topic: "Intro E&M", courses: ["PHYS 171", "PHYS 181", "PHYS 201"] },
  { topic: "General chemistry", courses: ["CHEM 161", "CHEM 165"] },
];

/**
 * Seeded co-enrollment sample: for each course, courses its students also
 * took, with the share of students (0..1). Symmetric lookups are derived.
 * Source: [Demo Sample] — replace with a CourseTable export.
 */
export const CO_ENROLLMENT_SAMPLE: Record<string, Record<string, number>> = {
  "CPSC 223": { "CPSC 202": 0.62, "MATH 222": 0.41, "CPSC 323": 0.35, "S&DS 242": 0.22 },
  "CPSC 202": { "CPSC 223": 0.58, "MATH 225": 0.3, "CPSC 201": 0.27 },
  "CPSC 323": { "CPSC 223": 0.7, "CPSC 365": 0.44 },
  "MATH 222": { "CPSC 223": 0.33, "PHYS 180": 0.29, "ECON 121": 0.18 },
  "MATH 225": { "MATH 230": 0.4, "CPSC 202": 0.31, "PHYS 200": 0.2 },
  "ECON 115": { "ECON 116": 0.71, "MATH 112": 0.38, "S&DS 101": 0.3, "ECON 117": 0.25 },
  "ECON 116": { "ECON 115": 0.66, "ECON 117": 0.34, "ECON 121": 0.28 },
  "HIST 202": { "HIST 203": 0.45, "HUMS 130": 0.3, "PLSC 114": 0.24 },
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

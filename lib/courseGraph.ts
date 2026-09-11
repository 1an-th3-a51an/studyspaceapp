import raw from "@/lib/data/courseGraph.json";

/**
 * The course-relatedness graph, loaded from a generated data file.
 *
 * `lib/data/courseGraph.json` ships with hand-written placeholder values so
 * the app runs out of the box, and is overwritten by
 * `npm run import:coursetable`. The file always carries its own provenance, so
 * the UI can state whether a link came from real data or from the sample
 * instead of hard-coding a disclaimer that goes stale the day real data lands.
 *
 * No model is involved at any point: relatedness is data, and a language model
 * guessing enrollment overlap would be worse than saying "sample".
 */
export type GraphKind =
  | "demo-sample"
  /** Counted overlap from a co-enrollment export: real "also took" shares. */
  | "coursetable-coenrollment"
  /** Derived from the public catalog: subject, level, and shared-course ids. */
  | "coursetable-catalog";

export type GraphProvenance = {
  kind: GraphKind;
  /** Short label for a UI chip, e.g. "CourseTable · Fall 2026". */
  label: string;
  /** One sentence explaining what the numbers mean. */
  detail: string;
  generatedAt: string | null;
  termLabel: string | null;
  courseCount: number;
  edgeCount: number;
};

export type EquivalenceGroup = { topic: string; courses: string[] };

export type CourseGraph = {
  provenance: GraphProvenance;
  equivalence: EquivalenceGroup[];
  /** courseCode -> { otherCourseCode -> share of students, 0..1 }. */
  coEnrollment: Record<string, Record<string, number>>;
  /** courseCode -> catalog title, when the import had titles. */
  titles: Record<string, string>;
};

const graph = raw as CourseGraph;

export const COURSE_GRAPH: CourseGraph = graph;

export const GRAPH_PROVENANCE: GraphProvenance = graph.provenance;

/** True when the graph is still the shipped placeholder. */
export function isSampleGraph(): boolean {
  return graph.provenance.kind === "demo-sample";
}

/** The catalog title for a course, when the import supplied one. */
export function courseTitle(courseCode: string): string | undefined {
  return graph.titles[courseCode];
}

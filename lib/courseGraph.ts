import raw from "@/lib/data/courseGraph.json";

/**
 * The course-relatedness graph, loaded from a generated data file.
 *
 * `lib/data/courseGraph.json` is written by `npm run import:coursetable` from
 * CourseTable's public catalog. Edges are catalog-description overlap, not
 * co-enrollment. Titles live here; full descriptions are in
 * `lib/data/courseDescriptions.json` so the client bundle stays smaller.
 */
export type GraphKind =
  | "demo-sample"
  | "coursetable-coenrollment"
  | "coursetable-catalog"
  | "coursetable-descriptions";

export type GraphProvenance = {
  kind: GraphKind;
  /** Short label for a UI chip, e.g. "CourseTable catalog descriptions · Fall 2026". */
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
  /** courseCode -> { otherCourseCode -> description-overlap score, 0..1 }. */
  descriptionSimilarity: Record<string, Record<string, number>>;
  /** Older imports stored subject-neighbor weights here. Ignored when the new field exists. */
  coEnrollment?: Record<string, Record<string, number>>;
  /** courseCode -> catalog title, when the import had titles. */
  titles: Record<string, string>;
};

const graph = raw as CourseGraph;

export const COURSE_GRAPH: CourseGraph = {
  ...graph,
  descriptionSimilarity: graph.descriptionSimilarity ?? graph.coEnrollment ?? {},
};

export const GRAPH_PROVENANCE: GraphProvenance = graph.provenance;

/** True when the graph is still the shipped placeholder. */
export function isSampleGraph(): boolean {
  return graph.provenance.kind === "demo-sample";
}

/** The catalog title for a course, when the import supplied one. */
export function courseTitle(courseCode: string): string | undefined {
  return graph.titles[courseCode];
}

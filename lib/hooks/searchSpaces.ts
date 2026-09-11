import { searchSpaces as searchLocally, type SpaceMatch } from "@/lib/spaceSearch";
import type { StudyRecommendation } from "@/lib/types";

export type SearchMethod = "lexical" | "embedding" | "local";

export type SpaceSearchResult = {
  method: SearchMethod;
  matches: SpaceMatch[];
};

/**
 * Search spots by a natural-language description.
 *
 * Demo mode never touches the network. Otherwise the server route is tried
 * (it can use embeddings when an API key is configured) and any failure falls
 * back to the same lexical scorer running in the browser.
 */
export async function searchSpaces(
  query: string,
  spots: StudyRecommendation[],
  options: { isDemo: boolean; signal?: AbortSignal },
): Promise<SpaceSearchResult> {
  const local = () => ({ method: "local" as const, matches: searchLocally(query, spots) });
  if (options.isDemo) return local();

  try {
    const res = await fetch("/api/search-spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, spots, isDemo: false }),
      signal: options.signal,
    });
    if (!res.ok) return local();
    const payload = (await res.json()) as {
      method: "lexical" | "embedding";
      wantedCapacity?: number;
      results: { name: string; score: number; matchedTerms: string[] }[];
    };
    const byName = new Map(spots.map((s) => [s.name, s]));
    const matches: SpaceMatch[] = [];
    for (const r of payload.results) {
      const spot = byName.get(r.name);
      if (!spot) continue;
      matches.push({
        spot,
        score: r.score,
        matchedTerms: r.matchedTerms,
        wantedCapacity: payload.wantedCapacity,
      });
    }
    return { method: payload.method, matches };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return local();
  }
}

import { DEMO_RECOMMENDATIONS } from "@/lib/demo/handsomeDan";
import { searchSpaces, type SpaceMatch } from "@/lib/spaceSearch";
import type { StudyRecommendation } from "@/lib/types";

export const maxDuration = 60;

const EMBED_TIMEOUT_MS = 15_000;
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

type SearchRequest = {
  query?: unknown;
  isDemo?: unknown;
  spots?: unknown;
};

export type SearchResponse = {
  method: "lexical" | "embedding";
  results: {
    name: string;
    score: number;
    matchedTerms: string[];
  }[];
  wantedCapacity?: number;
};

function spotText(spot: StudyRecommendation): string {
  return [
    spot.name,
    spot.kind === "coffee" ? "Coffee shop." : "Bookable study room.",
    spot.description ?? "",
    spot.tags?.length ? `Features: ${spot.tags.join(", ")}.` : "",
    typeof spot.capacity === "number" ? `Fits ${spot.capacity} people.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

async function embed(inputs: string[], apiKey: string): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const payload = (await res.json()) as { data?: { embedding: number[] }[] };
    const vectors = payload.data?.map((d) => d.embedding);
    if (!vectors || vectors.length !== inputs.length) throw new Error("bad embedding payload");
    return vectors;
  } finally {
    clearTimeout(timer);
  }
}

function toResponse(method: SearchResponse["method"], matches: SpaceMatch[]): SearchResponse {
  return {
    method,
    wantedCapacity: matches[0]?.wantedCapacity,
    results: matches.map((m) => ({
      name: m.spot.name,
      score: m.score,
      matchedTerms: m.matchedTerms,
    })),
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: SearchRequest;
  try {
    body = (await request.json()) as SearchRequest;
  } catch {
    body = {};
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const spots: StudyRecommendation[] = Array.isArray(body.spots)
    ? (body.spots as StudyRecommendation[])
    : DEMO_RECOMMENDATIONS;

  const lexical = searchSpaces(query, spots);
  const apiKey = process.env.OPENAI_API_KEY;

  if (body.isDemo === true || !apiKey) {
    return Response.json(toResponse("lexical", lexical));
  }

  try {
    const vectors = await embed([query, ...spots.map(spotText)], apiKey);
    const [q, ...docs] = vectors;
    const lexicalByName = new Map(lexical.map((m) => [m.spot.name, m]));
    const wantedCapacity = lexical[0]?.wantedCapacity;

    const scored = spots.map((spot, i) => {
      const sim = cosine(q, docs[i]);
      const lex = lexicalByName.get(spot.name);
      let score = sim;
      if (wantedCapacity !== undefined && typeof spot.capacity === "number") {
        score += spot.capacity >= wantedCapacity ? 0.05 : -0.15;
      }
      return {
        spot,
        score,
        matchedTerms: lex?.matchedTerms ?? [],
        wantedCapacity,
      } satisfies SpaceMatch;
    });
    const best = Math.max(...scored.map((s) => s.score), 0);
    const normalized = scored
      .map((s) => ({ ...s, score: best > 0 ? Math.max(0, s.score) / best : 0 }))
      .sort((a, b) => b.score - a.score);
    return Response.json(toResponse("embedding", normalized));
  } catch {
    // Provider trouble should never break the page; fall back silently.
    return Response.json(toResponse("lexical", lexical));
  }
}

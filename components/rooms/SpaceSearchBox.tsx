"use client";

import { Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SearchMethod } from "@/lib/hooks/searchSpaces";

const EXAMPLES = [
  "quiet spot to read alone with natural light",
  "whiteboard and a screen for 5 people",
  "coffee and outlets to code with a friend",
  "group of 8 near Science Hill",
];

export function SpaceSearchBox({
  query,
  onQueryChange,
  searching,
  method,
  resultCount,
  wantedCapacity,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  searching: boolean;
  method: SearchMethod | null;
  resultCount: number;
  wantedCapacity?: number;
}) {
  const active = query.trim().length > 0;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="space-query">Describe what you need</Label>
        {active && method ? (
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3" />
            {method === "embedding" ? "Semantic match" : "On-device match"}
          </Badge>
        ) : null}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="space-query"
            className="pl-8"
            placeholder="e.g. quiet room with a whiteboard for 4 people near Science Hill"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            autoComplete="off"
          />
        </div>
        {active ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Clear search"
            onClick={() => onQueryChange("")}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      {active ? (
        <p className="text-xs text-muted-foreground">
          {searching
            ? "Searching…"
            : resultCount === 0
              ? "No spots match that description. Try fewer or different words."
              : `${resultCount} matching spot${resultCount === 1 ? "" : "s"}, best match first.` +
                (wantedCapacity ? ` Looking for room for ${wantedCapacity}.` : "")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => onQueryChange(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

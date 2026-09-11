"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/format";
import {
  KARMA_RULES,
  KARMA_STORAGE_KEY,
  nextTier,
  readKarma,
  tierFor,
  type KarmaState,
} from "@/lib/karma";

export function KarmaCard() {
  const [state, setState] = useState<KarmaState | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const load = () => setState(readKarma());
    const timer = window.setTimeout(load, 0);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KARMA_STORAGE_KEY) load();
    };
    window.addEventListener("studyspace:karma", load);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("studyspace:karma", load);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!state) return null;
  const tier = tierFor(state.score);
  const next = nextTier(state.score);
  const progress = next
    ? Math.min(1, (state.score - tier.min) / Math.max(1, next.min - tier.min))
    : 1;

  return (
    <section id="karma" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="size-4 text-primary" />
          Karma
        </h2>
        <span className="text-xs text-muted-foreground">
          Stored on this device. A nudge, not a gate.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-4xl font-semibold tabular-nums">{state.score}</div>
          <Badge>{tier.name}</Badge>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {next
              ? `${next.min - state.score} to ${next.name}. ${tier.blurb}`
              : tier.blurb}
          </p>
        </div>
      </div>

      {state.events.length > 0 ? (
        <ul className="divide-y rounded-lg border text-sm">
          {state.events.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="truncate">{e.note}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {formatWhen(e.at)}
                <Badge variant={e.delta >= 0 ? "secondary" : "destructive"} className="tabular-nums">
                  {e.delta >= 0 ? "+" : ""}
                  {e.delta}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing logged yet. Host a pool, join a booked room, or release a room you no longer need.
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => setShowRules((v) => !v)}
        aria-expanded={showRules}
      >
        <ChevronDown className={`size-3.5 transition-transform ${showRules ? "rotate-180" : ""}`} />
        How karma works
      </Button>
      {showRules ? (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {KARMA_RULES.map((r) => (
            <li key={r.kind} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
              <span>{r.label}</span>
              <Badge variant={r.delta >= 0 ? "secondary" : "destructive"} className="tabular-nums">
                {r.delta >= 0 ? "+" : ""}
                {r.delta}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

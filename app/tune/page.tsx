"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getBuilding } from "@/lib/geo";
import { getRoomPrefs } from "@/lib/scheduleStore";
import { applyTune, readTune, resetTune, type TuneChange, type TunePrefs } from "@/lib/tune";
import type { RoomPrefs } from "@/lib/types";

const EXAMPLES = [
  "I have a midterm Friday. Quiet room with a whiteboard near Science Hill, no coffee shops, and I hate walking.",
  "Chill afternoon, coffee is fine, happy to walk 15 min, usually studying with 3 friends.",
  "I write essays alone and want natural light and outlets, near HQ.",
  "Group of 5 rehearsing a presentation after class, need a monitor.",
];

export default function TunePage() {
  const [text, setText] = useState("");
  const [changes, setChanges] = useState<TuneChange[] | null>(null);
  const [tune, setTune] = useState<TunePrefs | null>(null);
  const [room, setRoom] = useState<RoomPrefs | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const t = readTune();
      setTune(t);
      setRoom(getRoomPrefs());
      setText(t.lastPrompt);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function apply(input: string) {
    const result = applyTune(input);
    setChanges(result.changes);
    setTune(result.prefs);
    setRoom(getRoomPrefs());
  }

  function reset() {
    resetTune();
    setChanges([]);
    setTune(readTune());
    setRoom(getRoomPrefs());
    setText("");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Tune</h1>
        <p className="text-sm text-muted-foreground">
          Tell the app how you study. It reshapes its defaults around you: the
          Rooms ranking, where you start walking from, the search prefill, and
          your default group size. Same design, fewer clicks. Runs offline.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Label htmlFor="tune-text">How do you like to study?</Label>
        <Textarea
          id="tune-text"
          rows={4}
          placeholder="e.g. Finals week. Silent room with outlets near Sterling, no cafes, I study alone."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => apply(text)} disabled={!text.trim()}>
            <Wand2 className="size-3.5" />
            Apply
          </Button>
          <Button variant="outline" onClick={reset}>
            Reset to defaults
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/rooms">Open Rooms</Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-full border px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                setText(ex);
                apply(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {changes ? (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <h2 className="text-sm font-medium">
            {changes.length === 0 ? "Nothing I could map. Try naming a place, a vibe, or a group size." : "Applied"}
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {changes.map((c) => (
              <li key={c.label}>
                <Badge variant="secondary">
                  {c.label}: {c.value}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {room && tune ? (
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
          <h2 className="inline-flex items-center gap-2 font-medium">
            <SlidersHorizontal className="size-4" />
            Current setup
          </h2>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <dt className="text-muted-foreground">Coffee shops</dt>
            <dd>{room.includeCoffeeShops ? "on" : "off"}</dd>
            <dt className="text-muted-foreground">Exam urgency</dt>
            <dd>{room.examUrgency.toFixed(2)}</dd>
            <dt className="text-muted-foreground">Extra walking for coffee</dt>
            <dd>{room.maxExtraWalkingMinutes} min</dd>
            <dt className="text-muted-foreground">Default group size</dt>
            <dd>{tune.preferredGroupSize ?? "not set"}</dd>
            <dt className="text-muted-foreground">Start walking from</dt>
            <dd>{tune.landmarkId ? getBuilding(tune.landmarkId)?.name ?? tune.landmarkId : "next class"}</dd>
            <dt className="text-muted-foreground">Rooms search prefill</dt>
            <dd>{tune.defaultQuery || "none"}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Every one of these is also editable by hand on the Rooms page.
          </p>
        </div>
      ) : null}
    </div>
  );
}

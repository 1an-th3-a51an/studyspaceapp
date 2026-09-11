"use client";

import { useEffect, useRef, useState } from "react";
import { Gamepad2, LogOut, Radio } from "lucide-react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { joinQueue, leaveQueue } from "@/lib/hooks/queue";
import { getDisplayName, setDisplayName as persistDisplayName } from "@/lib/identity";
import { announceJoin } from "@/lib/joinBanner";
import { failsProfanityCheck } from "@/lib/profanity";
import type { QueueSnapshot } from "@/lib/types";

export function LiveQueue({
  courseCode,
  snapshot,
  available,
  onSnapshot,
}: {
  courseCode: string;
  snapshot: QueueSnapshot | null;
  available: boolean;
  onSnapshot: (next: QueueSnapshot) => void;
}) {
  const [name, setName] = useState(() => getDisplayName());
  const [size, setSize] = useState("3");
  const [error, setError] = useState("");

  const waiting = (snapshot?.queue ?? []).filter((e) => !e.poolId);
  const mine = snapshot?.myEntry ?? null;
  const myPool =
    mine?.poolId ? snapshot?.pools.find((p) => p.id === mine.poolId) ?? null : null;
  const target = mine?.targetGroupSize ?? Number(size);

  // A pool can form on any poll, not just on the click that joined the queue,
  // so the banner fires on the transition into a pool rather than inline.
  // The first snapshot only records the starting state, so arriving on a page
  // where you are already matched does not replay the banner.
  const lastPoolId = useRef<{ initialised: boolean; id: string | null }>({
    initialised: false,
    id: null,
  });
  useEffect(() => {
    if (!snapshot) return;
    const id = myPool?.id ?? null;
    if (!lastPoolId.current.initialised) {
      lastPoolId.current = { initialised: true, id };
      return;
    }
    if (id && id !== lastPoolId.current.id && myPool) {
      announceJoin({
        title: "Matched into a study pool",
        detail: `${myPool.courseCode} · ${myPool.memberCount} of ${myPool.targetGroupSize} · hosted by ${myPool.hostDisplayName}`,
      });
    }
    lastPoolId.current.id = id;
  }, [snapshot, myPool]);

  async function join() {
    if (!name.trim()) {
      setError("Display name is required.");
      return;
    }
    if (failsProfanityCheck(name)) {
      setError("Display name failed the 5-word check.");
      return;
    }
    setError("");
    persistDisplayName(name.trim());
    try {
      const result = await joinQueue({
        courseCode,
        displayName: name.trim(),
        targetGroupSize: Number(size),
      });
      onSnapshot(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join queue");
    }
  }

  async function leave() {
    try {
      onSnapshot(await leaveQueue(courseCode));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not leave queue");
    }
  }

  if (!available) {
    return (
      <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Live queue API not deployed yet.
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-heading text-lg font-semibold">
          <Gamepad2 className="size-4" />
          Live queue · {courseCode}
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radio className="size-3 animate-pulse text-primary" />
          {snapshot ? "polling every 3s" : "connecting…"}
        </span>
      </div>

      {myPool ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="font-medium">
            Matched! Pool of {myPool.memberCount} formed for {myPool.courseCode}.
          </p>
          <p className="text-muted-foreground">
            With{" "}
            {(snapshot?.queue ?? [])
              .filter((e) => e.poolId === myPool.id)
              .map((e) => e.displayName)
              .join(", ")}
            . It is now listed under pools below.
          </p>
        </div>
      ) : mine ? (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            Waiting {waiting.length}/{target} · {Math.max(0, target - waiting.length)} more
            needed
          </p>
          <div className="flex flex-wrap gap-1.5">
            {waiting.map((e) => (
              <Badge key={e.id} variant={e.deviceId === mine.deviceId ? "default" : "secondary"}>
                {e.displayName}
                {e.deviceId === mine.deviceId ? " (you)" : ""}
              </Badge>
            ))}
            {Array.from({ length: Math.max(0, target - waiting.length) }).map((_, i) => (
              <Badge key={`slot-${i}`} variant="outline" className="border-dashed">
                open slot
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tell friends to open this page and queue for {courseCode}. A pool forms the moment
            enough people are waiting. Leaving the tab for 45s drops you out.
          </p>
          <Button size="sm" variant="outline" onClick={leave}>
            <LogOut className="size-3.5" />
            Leave queue
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {waiting.length === 0
              ? "Nobody is queued right now. Be the first."
              : `${waiting.length} waiting: ${waiting.map((e) => e.displayName).join(", ")}`}
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="queue-name">Display name</Label>
              <Input
                id="queue-name"
                placeholder="Eli '27"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="queue-size">Group size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger id="queue-size" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DebouncedSubmitButton onSubmit={join}>Queue up</DebouncedSubmitButton>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

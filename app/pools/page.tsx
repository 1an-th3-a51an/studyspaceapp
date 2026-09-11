"use client";

import { useCallback, useEffect, useState } from "react";
import { JoinHostPoolModal } from "@/components/pools/JoinHostPoolModal";
import { LiveQueue } from "@/components/pools/LiveQueue";
import { OpenBookings } from "@/components/pools/OpenBookings";
import { PoolList } from "@/components/pools/PoolList";
import { SimilarCoursePools } from "@/components/pools/SimilarCoursePools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hostPool,
  joinPool,
  listPoolsByCourseCode,
} from "@/lib/hooks/listPools";
import { useQueuePolling } from "@/lib/hooks/queue";
import { seedDb } from "@/lib/hooks/seedDb";
import { normalizeCourseCode } from "@/lib/courseSimilarity";
import { DEFAULT_COURSE_CODE } from "@/lib/demo/handsomeDan";
import { setDisplayName } from "@/lib/identity";
import type { StudyPool } from "@/lib/types";

export default function PoolsPage() {
  const [courseCode, setCourseCode] = useState(DEFAULT_COURSE_CODE);
  const [pools, setPools] = useState<StudyPool[]>([]);
  const [wired, setWired] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<StudyPool | null>(null);
  const [error, setError] = useState("");
  const [seedMessage, setSeedMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const normalizedCourse = normalizeCourseCode(courseCode.trim() || DEFAULT_COURSE_CODE);
  const queue = useQueuePolling(normalizedCourse);

  const refresh = useCallback(async (code: string) => {
    const result = await listPoolsByCourseCode(code.trim() || DEFAULT_COURSE_CODE);
    setPools(result.pools);
    setWired(result.wired);
  }, []);

  // Similar-course pools refetch only after something changed (seed/host/join).
  const bump = () => setRefreshKey((k) => k + 1);

  // Deep link from the Rooms page: /pools?course=S%26DS%202380
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("course");
    if (!fromUrl) return;
    const timer = window.setTimeout(() => setCourseCode(normalizeCourseCode(fromUrl)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(courseCode).catch((caught) => {
        setError(
          caught instanceof Error ? caught.message : "Could not list pools",
        );
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [courseCode, refresh]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Peer study pools
          </h1>
          <Label htmlFor="course-code">Course code</Label>
          <Input
            id="course-code"
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value.toUpperCase())}
            placeholder={DEFAULT_COURSE_CODE}
            className="max-w-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setSeedMessage("");
              try {
                await seedDb();
                setSeedMessage("Seed API returned OK.");
                await refresh(courseCode);
                bump();
              } catch (caught) {
                setSeedMessage(
                  caught instanceof Error ? caught.message : "Seed failed",
                );
              }
            }}
          >
            Seed DB
          </Button>
          <Button
            onClick={() => {
              setSelected(null);
              setModalOpen(true);
            }}
          >
            Join / Host Pool
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {seedMessage ? (
        <p className="text-sm text-muted-foreground">{seedMessage}</p>
      ) : null}
      <OpenBookings
        courseCode={normalizedCourse}
        snapshot={queue.snapshot}
        onSnapshot={queue.setSnapshot}
        onNeedName={() => {
          setSelected(null);
          setModalOpen(true);
        }}
      />
      <LiveQueue
        courseCode={normalizedCourse}
        snapshot={queue.snapshot}
        available={queue.available}
        onSnapshot={queue.setSnapshot}
      />
      {queue.error ? <p className="text-sm text-destructive">{queue.error}</p> : null}
      <PoolList
        pools={[...(queue.snapshot?.pools ?? []), ...pools]}
        wired={wired}
        onJoin={(pool) => {
          setSelected(pool);
          setModalOpen(true);
        }}
      />
      <SimilarCoursePools
        courseCode={normalizedCourse}
        refreshKey={refreshKey}
        onPickCourse={(code) => setCourseCode(code)}
        onJoin={(pool) => {
          setSelected(pool);
          setModalOpen(true);
        }}
      />
      <JoinHostPoolModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        courseCode={selected?.courseCode ?? (courseCode.trim() || DEFAULT_COURSE_CODE)}
        selectedPool={selected}
        onHost={async ({ displayName, targetGroupSize }) => {
          setDisplayName(displayName);
          await hostPool({
            courseCode: courseCode.trim() || DEFAULT_COURSE_CODE,
            hostDisplayName: displayName,
            targetGroupSize,
          });
          await refresh(courseCode);
          bump();
        }}
        onJoin={async ({ displayName, pool }) => {
          setDisplayName(displayName);
          await joinPool({ poolId: pool.id });
          await refresh(courseCode);
          bump();
        }}
      />
    </div>
  );
}

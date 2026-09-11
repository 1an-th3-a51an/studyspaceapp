"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BackendChip } from "@/components/pools/BackendChip";
import { JoinHostPoolModal } from "@/components/pools/JoinHostPoolModal";
import { LiveQueue } from "@/components/pools/LiveQueue";
import { OpenBookings } from "@/components/pools/OpenBookings";
import { PoolList } from "@/components/pools/PoolList";
import { SimilarCoursePools } from "@/components/pools/SimilarCoursePools";
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
import {
  hostPool,
  joinPool,
  listPoolsByCourseCode,
} from "@/lib/hooks/listPools";
import { useQueuePolling } from "@/lib/hooks/queue";
import { seedDb } from "@/lib/hooks/seedDb";
import { useSchedule } from "@/lib/hooks/useSchedule";
import { normalizeCourseCode } from "@/lib/courseSimilarity";
import { DEFAULT_COURSE_CODE } from "@/lib/demo/handsomeDan";
import { setDisplayName } from "@/lib/identity";
import { announceJoin } from "@/lib/joinBanner";
import type { BackendInfo, StudyPool } from "@/lib/types";

const CUSTOM = "__custom__";

export default function PoolsPage() {
  const schedule = useSchedule();
  const [courseCode, setCourseCode] = useState("");
  const [custom, setCustom] = useState(false);
  const [pools, setPools] = useState<StudyPool[]>([]);
  const [backend, setBackend] = useState<BackendInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<StudyPool | null>(null);
  const [error, setError] = useState("");
  const [seedMessage, setSeedMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Set once the URL or the user picks a course, so the schedule stops
  // overriding the choice on the next poll.
  const pinned = useRef(false);

  const activeCourse = normalizeCourseCode(
    courseCode.trim() ||
      (schedule.origin === "demo" ? DEFAULT_COURSE_CODE : schedule.primaryCourseCode),
  );
  const queue = useQueuePolling(activeCourse);

  const refresh = useCallback(async (code: string) => {
    if (!code) {
      setPools([]);
      return;
    }
    const result = await listPoolsByCourseCode(code);
    setPools(result.pools);
    setBackend(result.backend);
  }, []);

  // Similar-course pools refetch only after something changed (seed/host/join).
  const bump = () => setRefreshKey((k) => k + 1);

  function chooseCourse(code: string) {
    pinned.current = true;
    setCourseCode(code);
  }

  // Deep link from the Rooms page: /pools?course=S%26DS%202380
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("course");
    if (!fromUrl) return;
    const timer = window.setTimeout(() => {
      pinned.current = true;
      setCourseCode(normalizeCourseCode(fromUrl));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Follow the connected calendar until the user picks something themselves.
  useEffect(() => {
    if (!schedule.ready || pinned.current) return;
    setCourseCode(schedule.primaryCourseCode || (schedule.origin === "demo" ? DEFAULT_COURSE_CODE : ""));
  }, [schedule.ready, schedule.primaryCourseCode, schedule.origin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(activeCourse).catch((caught) => {
        setError(
          caught instanceof Error ? caught.message : "Could not list pools",
        );
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCourse, refresh]);

  const myCourses = schedule.courses;
  const onMySchedule = myCourses.some((c) => c.courseCode === activeCourse);
  const showPicker = myCourses.length > 0 && !custom;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Peer study pools
          </h1>
          <Label htmlFor="course-code">Course</Label>
          {showPicker ? (
            <Select
              value={onMySchedule ? activeCourse : CUSTOM}
              onValueChange={(value) => {
                if (value === CUSTOM) {
                  setCustom(true);
                  return;
                }
                chooseCourse(value);
              }}
            >
              <SelectTrigger id="course-code" className="min-w-72">
                <SelectValue placeholder="Pick one of your courses" />
              </SelectTrigger>
              <SelectContent>
                {myCourses.map((course) => (
                  <SelectItem key={course.courseCode} value={course.courseCode}>
                    {course.title && course.title !== course.courseCode
                      ? `${course.courseCode} · ${course.title}`
                      : course.courseCode}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>Another course…</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="course-code"
                value={courseCode}
                onChange={(event) => chooseCourse(event.target.value.toUpperCase())}
                placeholder={DEFAULT_COURSE_CODE}
                className="max-w-xs"
              />
              {myCourses.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setCustom(false)}>
                  Back to my courses
                </Button>
              ) : null}
            </div>
          )}
          {schedule.ready && myCourses.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <Link href="/connect" className="underline underline-offset-4">
                Connect a calendar
              </Link>{" "}
              to pick from your own courses.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <BackendChip backend={backend} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                setSeedMessage("");
                try {
                  const result = (await seedDb()) as { message?: string };
                  setSeedMessage(result.message ?? "Seed API returned OK.");
                  await refresh(activeCourse);
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
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {seedMessage ? (
        <p className="text-sm text-muted-foreground">{seedMessage}</p>
      ) : null}
      <OpenBookings
        courseCode={activeCourse}
        snapshot={queue.snapshot}
        onSnapshot={queue.setSnapshot}
        onNeedName={() => {
          setSelected(null);
          setModalOpen(true);
        }}
      />
      <LiveQueue
        courseCode={activeCourse}
        snapshot={queue.snapshot}
        available={queue.available}
        onSnapshot={queue.setSnapshot}
      />
      {queue.error ? <p className="text-sm text-destructive">{queue.error}</p> : null}
      <PoolList
        pools={
          schedule.origin === "imported"
            ? [...(queue.snapshot?.pools ?? []), ...pools].filter(
                (p) => !p.isDemoSample && !p.hostDisplayName.includes("[Demo Sample]"),
              )
            : [...(queue.snapshot?.pools ?? []), ...pools]
        }
        onJoin={(pool) => {
          setSelected(pool);
          setModalOpen(true);
        }}
      />
      <SimilarCoursePools
        courseCode={activeCourse}
        refreshKey={refreshKey}
        onPickCourse={chooseCourse}
        onJoin={(pool) => {
          setSelected(pool);
          setModalOpen(true);
        }}
      />
      <JoinHostPoolModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        courseCode={selected?.courseCode ?? activeCourse}
        selectedPool={selected}
        onHost={async ({ displayName, targetGroupSize }) => {
          setDisplayName(displayName);
          const { pool } = await hostPool({
            courseCode: activeCourse,
            hostDisplayName: displayName,
            targetGroupSize,
          });
          announceJoin({
            title: "You're hosting a study pool",
            detail: `${pool.courseCode} · ${pool.memberCount} of ${pool.targetGroupSize} seats filled`,
          });
          await refresh(activeCourse);
          bump();
        }}
        onJoin={async ({ displayName, pool }) => {
          setDisplayName(displayName);
          const result = await joinPool({ poolId: pool.id });
          announceJoin({
            title: "You're in a study pool",
            detail: `${result.pool.courseCode} · ${result.pool.memberCount} of ${result.pool.targetGroupSize} · hosted by ${result.pool.hostDisplayName}`,
          });
          await refresh(activeCourse);
          bump();
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { GitBranch, Users } from "lucide-react";
import { DemoSampleBadge } from "@/components/pools/DemoSampleBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { similarCourses, type SimilarCourse } from "@/lib/courseSimilarity";
import { listPoolsByCourseCode } from "@/lib/hooks/listPools";
import type { StudyPool } from "@/lib/types";

type Row = SimilarCourse & { pools: StudyPool[] };

function showDemoBadge(pool: StudyPool): boolean {
  return pool.isDemoSample || pool.hostDisplayName.includes("[Demo Sample]");
}

export function SimilarCoursePools({
  courseCode,
  refreshKey,
  onPickCourse,
  onJoin,
}: {
  courseCode: string;
  /** Bump to refetch (after hosting/joining/seeding). */
  refreshKey: number;
  onPickCourse: (code: string) => void;
  onJoin: (pool: StudyPool) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const similar = similarCourses(courseCode);
    let cancelled = false;
    if (similar.length === 0) {
      const timer = window.setTimeout(() => {
        if (!cancelled) setRows([]);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    const timer = window.setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, 0);
    Promise.all(
      similar.map(async (s) => {
        try {
          const { pools } = await listPoolsByCourseCode(s.courseCode);
          return { ...s, pools };
        } catch {
          return { ...s, pools: [] };
        }
      }),
    ).then((result) => {
      if (cancelled) return;
      setRows(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [courseCode, refreshKey]);

  if (rows.length === 0 && !loading) return null;

  const withPools = rows.filter((r) => r.pools.length > 0);
  const without = rows.filter((r) => r.pools.length === 0);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-heading text-lg font-semibold">
          <GitBranch className="size-4" />
          Pools in similar courses
        </h2>
        <span className="text-xs text-muted-foreground">
          Co-enrollment links are a seeded sample, not live CourseTable data.
        </span>
      </div>
      {loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Looking for related pools…</p>
      ) : null}

      {withPools.map((row) => (
        <div key={row.courseCode} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="font-medium underline-offset-4 hover:underline"
              onClick={() => onPickCourse(row.courseCode)}
            >
              {row.courseCode}
            </button>
            <Badge variant={row.reason === "equivalent" ? "default" : "secondary"}>
              {row.label}
            </Badge>
          </div>
          <ul className="space-y-1.5">
            {row.pools.map((pool) => (
              <li
                key={pool.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span>{pool.hostDisplayName}</span>
                  {showDemoBadge(pool) ? <DemoSampleBadge /> : null}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Users className="size-3" />
                    {pool.memberCount}/{pool.targetGroupSize}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pool.memberCount >= pool.targetGroupSize}
                  onClick={() => onJoin(pool)}
                >
                  Join
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {without.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          No pools yet in{" "}
          {without.map((r, i) => (
            <span key={r.courseCode}>
              {i > 0 ? ", " : ""}
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={() => onPickCourse(r.courseCode)}
                title={r.label}
              >
                {r.courseCode}
              </button>
            </span>
          ))}
          .
        </p>
      ) : null}
    </section>
  );
}

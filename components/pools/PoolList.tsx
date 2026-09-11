"use client";

import { DemoSampleBadge } from "@/components/pools/DemoSampleBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StudyPool } from "@/lib/types";

function showDemoBadge(pool: StudyPool): boolean {
  return pool.isDemoSample || pool.hostDisplayName.includes("[Demo Sample]");
}

export function PoolList({
  pools,
  wired,
  onJoin,
}: {
  pools: StudyPool[];
  wired: boolean;
  onJoin: (pool: StudyPool) => void;
}) {
  const uniquePools = Array.from(
    new Map(pools.map((pool) => [pool.id, pool])).values(),
  );

  return (
    <div className="space-y-3">
      {!wired ? (
        <p className="text-sm text-muted-foreground">Seed DB not wired</p>
      ) : null}
      {uniquePools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pools for this course yet. Host one to get started.
        </p>
      ) : (
        uniquePools.map((pool) => (
          <Card key={pool.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  {pool.courseCode} · {pool.hostDisplayName}
                </CardTitle>
                {showDemoBadge(pool) ? <DemoSampleBadge /> : null}
              </div>
              <CardDescription>
                {pool.memberCount}/{pool.targetGroupSize} people · hosted{" "}
                {new Date(pool.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant="outline"
                disabled={pool.memberCount >= pool.targetGroupSize}
                onClick={() => onJoin(pool)}
              >
                Join
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

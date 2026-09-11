"use client";

import { useCallback, useEffect, useState } from "react";
import { JoinHostPoolModal } from "@/components/pools/JoinHostPoolModal";
import { PoolList } from "@/components/pools/PoolList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hostPool,
  joinPool,
  listPoolsByCourseCode,
} from "@/lib/hooks/listPools";
import { seedDb } from "@/lib/hooks/seedDb";
import { setDisplayName } from "@/lib/identity";
import type { StudyPool } from "@/lib/types";

export default function PoolsPage() {
  const [courseCode, setCourseCode] = useState("CPSC 223");
  const [pools, setPools] = useState<StudyPool[]>([]);
  const [wired, setWired] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<StudyPool | null>(null);
  const [error, setError] = useState("");
  const [seedMessage, setSeedMessage] = useState("");

  const refresh = useCallback(async (code: string) => {
    const result = await listPoolsByCourseCode(code.trim() || "CPSC 223");
    setPools(result.pools);
    setWired(result.wired);
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
            placeholder="CPSC 223"
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
      <PoolList
        pools={pools}
        wired={wired}
        onJoin={(pool) => {
          setSelected(pool);
          setModalOpen(true);
        }}
      />
      <JoinHostPoolModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        courseCode={courseCode.trim() || "CPSC 223"}
        selectedPool={selected}
        onHost={async ({ displayName, targetGroupSize }) => {
          setDisplayName(displayName);
          await hostPool({
            courseCode: courseCode.trim() || "CPSC 223",
            hostDisplayName: displayName,
            targetGroupSize,
          });
          await refresh(courseCode);
        }}
        onJoin={async ({ displayName, pool }) => {
          setDisplayName(displayName);
          await joinPool({ poolId: pool.id });
          await refresh(courseCode);
        }}
      />
    </div>
  );
}

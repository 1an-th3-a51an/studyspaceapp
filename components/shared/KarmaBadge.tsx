"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { KARMA_START, KARMA_STORAGE_KEY, readKarma, tierFor } from "@/lib/karma";

export function KarmaBadge() {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    const load = () => setScore(readKarma().score);
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

  const value = score ?? KARMA_START;
  return (
    <Link
      href="/pools#karma"
      title={`${tierFor(value).name} · karma for sharing rooms and pooling`}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Sparkles className="size-3 text-primary" />
      {value}
    </Link>
  );
}

"use client";

import { Database, HardDrive, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BackendInfo } from "@/lib/types";

/**
 * Says where pools are stored, without implying the app is broken.
 *
 * The old copy told every local developer to go configure Firebase. Persisting
 * to a file is a legitimate single-server setup, so it reads as normal and only
 * the genuinely lossy in-memory case is flagged as a warning.
 */
export function BackendChip({ backend }: { backend: BackendInfo | null }) {
  if (!backend) return null;

  const Icon =
    backend.kind === "firestore"
      ? Database
      : backend.kind === "file"
        ? HardDrive
        : TriangleAlert;

  return (
    <Badge
      variant={backend.durable ? "secondary" : "outline"}
      className={
        "gap-1.5 font-normal " +
        (backend.durable ? "" : "border-destructive/50 text-destructive")
      }
      title={backend.detail}
    >
      <Icon className="size-3" aria-hidden />
      {backend.durable ? `Saved · ${backend.label}` : `Not saved · ${backend.label}`}
    </Badge>
  );
}

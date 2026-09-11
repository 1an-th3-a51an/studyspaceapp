"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STORAGE_KEYS } from "@/lib/identity";

export default function ClubsPage() {
  const [size, setSize] = useState(12);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(STORAGE_KEYS.clubSize);
      if (stored) setSize(Number(stored));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Club autobook
        </h1>
        <p className="text-sm text-muted-foreground">
          Size 1–200. This control does not call a backend.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="club-size">People</Label>
        <Input
          id="club-size"
          type="number"
          min={1}
          max={200}
          value={size}
          onChange={(event) => {
            const next = Math.min(200, Math.max(1, Number(event.target.value) || 1));
            setSize(next);
            localStorage.setItem(STORAGE_KEYS.clubSize, String(next));
          }}
        />
      </div>
      <Button
        type="button"
        onClick={() => {
          setMessage(
            `Autobook best room is a stub. Would search for ${size} people.`,
          );
        }}
      >
        Autobook best room
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNetId, setNetId } from "@/lib/identity";

export function NetIdForm() {
  const [netId, setNetIdState] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setNetIdState(getNetId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="yale-netid">Yale NetID</Label>
      <Input
        id="yale-netid"
        autoComplete="username"
        placeholder="e.g. abc123"
        value={netId}
        onChange={(event) => {
          const value = event.target.value;
          setNetIdState(value);
          setNetId(value);
        }}
      />
      <p className="text-xs text-muted-foreground">
        Display only. Stored in this browser. Never enter a Yale password here.
      </p>
    </div>
  );
}

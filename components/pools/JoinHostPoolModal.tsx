"use client";

import { useState } from "react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { failsProfanityCheck } from "@/lib/profanity";
import type { StudyPool } from "@/lib/types";

export function JoinHostPoolModal({
  open,
  onOpenChange,
  courseCode,
  selectedPool,
  onHost,
  onJoin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseCode: string;
  selectedPool: StudyPool | null;
  onHost: (input: {
    displayName: string;
    targetGroupSize: 1 | 2 | 3 | 4;
  }) => Promise<void>;
  onJoin: (input: { displayName: string; pool: StudyPool }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [size, setSize] = useState<1 | 2 | 3 | 4>(3);
  const [error, setError] = useState("");

  function validateName() {
    if (!displayName.trim()) {
      setError("Display name is required.");
      return false;
    }
    if (failsProfanityCheck(displayName)) {
      setError("Display name failed the 5-word check.");
      return false;
    }
    setError("");
    return true;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join / Host Pool</DialogTitle>
          <DialogDescription>
            Course {courseCode || "—"}. Name is stored on this device only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="Eli '27"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Target group size</Label>
            <Select
              value={String(size)}
              onValueChange={(value) =>
                setSize(Number(value) as 1 | 2 | 3 | 4)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <DebouncedSubmitButton
            variant="outline"
            disabled={!selectedPool}
            validate={validateName}
            onSubmit={async () => {
              if (!selectedPool) return;
              await onJoin({ displayName: displayName.trim(), pool: selectedPool });
              onOpenChange(false);
            }}
          >
            Join selected
          </DebouncedSubmitButton>
          <DebouncedSubmitButton
            validate={validateName}
            onSubmit={async () => {
              await onHost({
                displayName: displayName.trim(),
                targetGroupSize: size,
              });
              onOpenChange(false);
            }}
          >
            Host pool
          </DebouncedSubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

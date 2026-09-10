"use client";

import { useEffect, useMemo, useState } from "react";
import { RecommendationCard } from "@/components/rooms/RecommendationCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { STORAGE_KEYS } from "@/lib/identity";
import { recommendSpaces } from "@/lib/recommendations";
import { getRoomPrefs, setRoomPrefs } from "@/lib/scheduleStore";
import type { RoomPrefs } from "@/lib/types";

export default function RoomsPage() {
  const [prefs, setPrefs] = useState<RoomPrefs>({
    examUrgency: 0.4,
    includeCoffeeShops: true,
    maxExtraWalkingMinutes: 10,
  });
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    setPrefs(getRoomPrefs());
    setRecurring(localStorage.getItem(STORAGE_KEYS.recurringAutobook) === "true");
  }, []);

  function update(next: RoomPrefs) {
    setPrefs(next);
    setRoomPrefs(next);
  }

  const { primary, rest } = useMemo(() => recommendSpaces(prefs), [prefs]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Study spots
        </h1>
        <p className="text-sm text-muted-foreground">
          Decision sliders stay in localStorage. Autobook is intentionally stubbed.
        </p>
      </div>
      <div className="space-y-6 rounded-xl border bg-card p-4">
        <div className="space-y-2">
          <Label>Exam urgency ({prefs.examUrgency.toFixed(2)})</Label>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[prefs.examUrgency]}
            onValueChange={([value]) =>
              update({ ...prefs, examUrgency: value ?? 0 })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="coffee"
            checked={prefs.includeCoffeeShops}
            onCheckedChange={(checked) =>
              update({ ...prefs, includeCoffeeShops: checked === true })
            }
          />
          <Label htmlFor="coffee">Include coffee shops</Label>
        </div>
        <div className="space-y-2">
          <Label>
            Max extra walking minutes ({prefs.maxExtraWalkingMinutes})
          </Label>
          <Slider
            min={0}
            max={20}
            step={1}
            value={[prefs.maxExtraWalkingMinutes]}
            onValueChange={([value]) =>
              update({ ...prefs, maxExtraWalkingMinutes: value ?? 0 })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="recurring"
            checked={recurring}
            onCheckedChange={(checked) => {
              const on = checked === true;
              setRecurring(on);
              localStorage.setItem(STORAGE_KEYS.recurringAutobook, String(on));
            }}
          />
          <Label htmlFor="recurring">Recurring autobook (UI only)</Label>
        </div>
      </div>
      <RecommendationCard
        recommendation={primary}
        primary
        recurring={recurring}
      />
      <div className="space-y-4">
        {rest.map((item) => (
          <RecommendationCard
            key={item.name}
            recommendation={item}
            recurring={recurring}
          />
        ))}
      </div>
    </div>
  );
}

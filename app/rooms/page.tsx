"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocateFixed } from "lucide-react";
import { BookAndAnnounceDialog } from "@/components/rooms/BookAndAnnounceDialog";
import { RecommendationCard, type CardMatch } from "@/components/rooms/RecommendationCard";
import { SpaceSearchBox } from "@/components/rooms/SpaceSearchBox";
import { SpotMap } from "@/components/rooms/SpotMap";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DEMO_MEETINGS } from "@/lib/demo/handsomeDan";
import { formatWhen } from "@/lib/format";
import {
  DEFAULT_LANDMARK_ID,
  findBuilding,
  getBuilding,
  LANDMARK_IDS,
  type LatLng,
  type OriginChoice,
  type ResolvedOrigin,
} from "@/lib/geo";
import { isDemoMode, readJson, STORAGE_KEYS, writeJson } from "@/lib/identity";
import { searchSpaces, type SearchMethod } from "@/lib/hooks/searchSpaces";
import { recommendSpaces, type RankedSpot } from "@/lib/recommendations";
import { matchedTags, type SpaceMatch } from "@/lib/spaceSearch";
import { mergeSchedule } from "@/lib/scheduleMerge";
import {
  getCourseTableEvents,
  getGcalEvents,
  getRoomPrefs,
  setRoomPrefs,
} from "@/lib/scheduleStore";
import type { ClassMeeting, RoomPrefs, StudyRecommendation } from "@/lib/types";

const DEFAULT_ORIGIN: OriginChoice = { kind: "next-class" };

function originToValue(choice: OriginChoice): string {
  return choice.kind === "landmark" ? `landmark:${choice.id}` : choice.kind;
}

function valueToOrigin(value: string): OriginChoice {
  if (value === "gps") return { kind: "gps" };
  if (value.startsWith("landmark:")) {
    return { kind: "landmark", id: value.slice("landmark:".length) };
  }
  return { kind: "next-class" };
}

function pickNextClass(meetings: ClassMeeting[], now: number): ClassMeeting | null {
  const upcoming = meetings
    .filter((m) => new Date(m.end).getTime() > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  return upcoming[0] ?? meetings[0] ?? null;
}

export default function RoomsPage() {
  const [prefs, setPrefs] = useState<RoomPrefs>({
    examUrgency: 0.4,
    includeCoffeeShops: true,
    maxExtraWalkingMinutes: 10,
  });
  const [recurring, setRecurring] = useState(false);
  const [meetings, setMeetings] = useState<ClassMeeting[]>([]);
  const [originChoice, setOriginChoice] = useState<OriginChoice>(DEFAULT_ORIGIN);
  const [gpsPoint, setGpsPoint] = useState<LatLng | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "error">("idle");
  const [gpsError, setGpsError] = useState("");
  const [now, setNow] = useState(0);
  const [demo, setDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMethod, setSearchMethod] = useState<SearchMethod | null>(null);
  const [matches, setMatches] = useState<SpaceMatch[]>([]);
  const [booking, setBooking] = useState<StudyRecommendation | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPrefs(getRoomPrefs());
      setDemo(isDemoMode());
      setRecurring(localStorage.getItem(STORAGE_KEYS.recurringAutobook) === "true");
      setMeetings(
        mergeSchedule({
          gcal: getGcalEvents(),
          coursetable: getCourseTableEvents(),
          demo: isDemoMode(),
          demoMeetings: DEMO_MEETINGS,
        }),
      );
      setOriginChoice(readJson<OriginChoice>(STORAGE_KEYS.origin, DEFAULT_ORIGIN));
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function update(next: RoomPrefs) {
    setPrefs(next);
    setRoomPrefs(next);
  }

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("Geolocation is not available in this browser.");
      return;
    }
    setGpsStatus("locating");
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("idle");
      },
      (err) => {
        setGpsStatus("error");
        setGpsError(err.message || "Could not read your location.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  function chooseOrigin(value: string) {
    const choice = valueToOrigin(value);
    setOriginChoice(choice);
    writeJson(STORAGE_KEYS.origin, choice);
    if (choice.kind === "gps" && !gpsPoint) locate();
  }

  const nextClass = useMemo(() => pickNextClass(meetings, now), [meetings, now]);
  const nextClassBuilding = useMemo(
    () => findBuilding(nextClass?.location),
    [nextClass],
  );

  const origin: ResolvedOrigin | null = useMemo(() => {
    const fallback = getBuilding(DEFAULT_LANDMARK_ID)!;
    if (originChoice.kind === "gps") {
      return gpsPoint
        ? { label: "your location", detail: "GPS", point: gpsPoint }
        : null;
    }
    if (originChoice.kind === "landmark") {
      const b = getBuilding(originChoice.id) ?? fallback;
      return { label: b.name, detail: b.address, point: b.point };
    }
    if (nextClass && nextClassBuilding) {
      return {
        label: `${nextClass.courseCode} at ${nextClassBuilding.name}`,
        detail: `${formatWhen(nextClass.start)} · ${nextClass.location}`,
        point: nextClassBuilding.point,
      };
    }
    return {
      label: fallback.name,
      detail: nextClass
        ? `Could not place "${nextClass.location ?? "unknown location"}" on the map; using ${fallback.name}`
        : "No classes loaded; using a central landmark",
      point: fallback.point,
    };
  }, [originChoice, gpsPoint, nextClass, nextClassBuilding]);

  const { primary, rest } = useMemo(
    () => recommendSpaces(prefs, origin?.point ?? null),
    [prefs, origin],
  );

  const allSpots = useMemo(() => [primary, ...rest], [primary, rest]);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (!next.trim()) {
      setMatches([]);
      setSearching(false);
      setSearchMethod(null);
    } else {
      setSearching(true);
    }
  }

  // Natural-language search: debounce typing, abort stale requests.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchSpaces(trimmed, allSpots, { isDemo: demo, signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setMatches(result.matches);
          setSearchMethod(result.method);
          setSearching(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.error("space search failed", err);
          setMatches([]);
          setSearching(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, allSpots, demo]);

  const searchActive = query.trim().length > 0;

  // When a search is active, the list follows match order and keeps walking data.
  const displayed: { spot: RankedSpot; match?: CardMatch }[] = useMemo(() => {
    if (!searchActive) {
      return allSpots.map((spot) => ({ spot }));
    }
    const byName = new Map(allSpots.map((s) => [s.name, s]));
    const out: { spot: RankedSpot; match?: CardMatch }[] = [];
    for (const m of matches) {
      const spot = byName.get(m.spot.name);
      if (!spot) continue;
      out.push({ spot, match: { score: m.score, tags: matchedTags(m) } });
    }
    return out;
  }, [searchActive, allSpots, matches]);

  const mapSpots = useMemo(
    () => (searchActive ? displayed.map((d) => d.spot) : allSpots),
    [searchActive, displayed, allSpots],
  );
  const highlightName = displayed[0]?.spot.name ?? primary.name;
  const courseCodes = useMemo(
    () => Array.from(new Set(meetings.map((m) => m.courseCode))).sort(),
    [meetings],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Study spots
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranked by walking time from where you will be. Book a spot first, then
          your class and adjacent classes hear about it on the Pools page.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Label htmlFor="origin">Start walking from</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={originToValue(originChoice)} onValueChange={chooseOrigin}>
            <SelectTrigger id="origin" className="min-w-56">
              <SelectValue placeholder="Choose a starting point" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next-class">
                {nextClass
                  ? `Next class: ${nextClass.courseCode}${nextClass.location ? ` · ${nextClass.location}` : ""}`
                  : "Next class (none loaded)"}
              </SelectItem>
              <SelectItem value="gps">My location (GPS)</SelectItem>
              {LANDMARK_IDS.map((id) => {
                const b = getBuilding(id)!;
                return (
                  <SelectItem key={id} value={`landmark:${id}`}>
                    {b.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {originChoice.kind === "gps" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={locate}
              disabled={gpsStatus === "locating"}
            >
              <LocateFixed className="size-3.5" />
              {gpsStatus === "locating" ? "Locating…" : "Refresh location"}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {origin
            ? `${origin.label}${origin.detail ? ` — ${origin.detail}` : ""}`
            : gpsStatus === "error"
              ? gpsError
              : "Waiting for your location…"}
        </p>
      </div>

      <SpaceSearchBox
        query={query}
        onQueryChange={handleQueryChange}
        searching={searching}
        method={searchMethod}
        resultCount={displayed.length}
        wantedCapacity={matches[0]?.wantedCapacity}
      />

      <SpotMap
        origin={origin?.point ?? null}
        originLabel={origin?.label ?? "unknown"}
        spots={mapSpots}
        primaryName={highlightName}
      />

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
            Max extra walking minutes for coffee ({prefs.maxExtraWalkingMinutes})
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
          <p className="text-xs text-muted-foreground">
            A coffee shop wins only if it is at most this much further than the
            nearest bookable room.
          </p>
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

      {displayed.length === 0 && searchActive && !searching ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing matches yet. Clear the search to see spots ranked by walking time.
        </p>
      ) : null}
      <div className="space-y-4">
        {displayed.map(({ spot, match }, index) => (
          <RecommendationCard
            key={spot.name}
            recommendation={spot}
            primary={index === 0}
            recurring={recurring}
            originLabel={origin?.label}
            match={match}
            onBook={setBooking}
          />
        ))}
      </div>
      <BookAndAnnounceDialog
        spot={booking}
        courses={courseCodes}
        onOpenChange={(open) => {
          if (!open) setBooking(null);
        }}
      />
    </div>
  );
}

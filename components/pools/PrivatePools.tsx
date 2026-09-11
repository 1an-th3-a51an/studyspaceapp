"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, Lock, MapPin, UserPlus, X } from "lucide-react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen } from "@/lib/format";
import {
  cancelPrivatePool,
  createPrivatePool,
  respondPrivatePool,
  usePrivatePools,
} from "@/lib/hooks/privatePools";
import {
  ensureDeviceId,
  getDisplayName,
  getNetId,
  setDisplayName as persistDisplayName,
  setNetId as persistNetId,
} from "@/lib/identity";
import { announceJoin } from "@/lib/joinBanner";
import { awardKarma } from "@/lib/karma";
import { failsProfanityCheck } from "@/lib/profanity";
import { STUDY_SPOTS } from "@/lib/spots";
import {
  PRIVATE_POOL_REASONS,
  type MyCourse,
  type PrivatePool,
  type PrivatePoolReason,
} from "@/lib/types";

const NONE = "__none__";

function nextHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function reasonLabel(reason: PrivatePoolReason): string {
  return PRIVATE_POOL_REASONS.find((r) => r.value === reason)?.label ?? "Other";
}

export function PrivatePools({
  courses,
  defaultCourseCode,
}: {
  courses: MyCourse[];
  defaultCourseCode: string;
}) {
  const [netId, setNetId] = useState("");
  const [name, setName] = useState("");
  const [invitees, setInvitees] = useState("");
  const [reason, setReason] = useState<PrivatePoolReason>("writing-tutor");
  const [note, setNote] = useState("");
  const [course, setCourse] = useState(NONE);
  const [spot, setSpot] = useState(NONE);
  const [start, setStart] = useState(nextHourLocal);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNetId(getNetId());
      setName(getDisplayName());
      setCourse(defaultCourseCode || NONE);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [defaultCourseCode]);

  const normalizedNetId = netId.trim().toLowerCase();
  const { pools, error: pollError, available, refresh, setPools } = usePrivatePools(normalizedNetId);
  const deviceId = typeof window === "undefined" ? "" : ensureDeviceId();

  const invitesForMe = pools.filter(
    (p) =>
      p.hostDeviceId !== deviceId &&
      !p.members.some((m) => m.deviceId === deviceId) &&
      normalizedNetId &&
      p.inviteeNetIds.includes(normalizedNetId) &&
      !p.declinedNetIds.includes(normalizedNetId),
  );
  const mine = pools.filter(
    (p) => p.hostDeviceId === deviceId || p.members.some((m) => m.deviceId === deviceId),
  );

  function saveIdentity() {
    persistNetId(netId);
    persistDisplayName(name.trim());
  }

  async function create() {
    if (!name.trim()) return setError("Display name is required.");
    if (failsProfanityCheck(name)) return setError("Display name failed the 5-word check.");
    if (!normalizedNetId) return setError("Your NetID is required so invitees can see who asked.");
    const list = invitees
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (list.length === 0) return setError("Invite at least one NetID.");
    setError("");
    saveIdentity();
    const spotEntry = spot === NONE ? undefined : STUDY_SPOTS.find((s) => s.id === spot);
    const startMs = Date.parse(start);
    try {
      const { pool } = await createPrivatePool({
        displayName: name.trim(),
        netId: normalizedNetId,
        inviteeNetIds: list,
        reason,
        note: note.trim() || undefined,
        courseCode: course === NONE ? undefined : course,
        spotName: spotEntry?.name,
        start: Number.isNaN(startMs) ? undefined : new Date(startMs).toISOString(),
      });
      setPools((prev) => [pool, ...prev.filter((p) => p.id !== pool.id)]);
      awardKarma("invite-partner", `Invited ${list.join(", ")} (${reasonLabel(reason)})`);
      announceJoin({
        title: "Private pool created",
        detail: `${reasonLabel(reason)} · invited ${list.join(", ")} · +2 karma`,
      });
      setInvitees("");
      setNote("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create private pool");
    }
  }

  async function respond(pool: PrivatePool, accept: boolean) {
    if (!name.trim()) return setError("Add a display name first.");
    setError("");
    saveIdentity();
    try {
      const { pool: next } = await respondPrivatePool({
        poolId: pool.id,
        netId: normalizedNetId,
        displayName: name.trim(),
        accept,
      });
      setPools((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      if (accept) {
        awardKarma("pool-join", `Joined ${next.hostDisplayName}'s ${reasonLabel(next.reason).toLowerCase()} pool`);
        announceJoin({
          title: `You're in with ${next.hostDisplayName}`,
          detail: `${reasonLabel(next.reason)}${next.spotName ? ` · ${next.spotName}` : ""}${next.start ? ` · ${formatWhen(next.start)}` : ""} · +3 karma`,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not respond");
    }
  }

  async function cancel(pool: PrivatePool) {
    setError("");
    try {
      await cancelPrivatePool(pool.id);
      setPools((prev) => prev.filter((p) => p.id !== pool.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel");
    }
  }

  if (!available) return null;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-heading text-lg font-semibold">
          <Lock className="size-4" />
          Private pool · writing partner
        </h2>
        <span className="text-xs text-muted-foreground">
          Invite by NetID. Only invitees see it.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pp-netid">Your NetID</Label>
          <Input
            id="pp-netid"
            placeholder="abc123"
            autoComplete="username"
            value={netId}
            onChange={(e) => setNetId(e.target.value)}
            onBlur={() => persistNetId(netId)}
          />
          <p className="text-xs text-muted-foreground">
            Used only to match invites. Never a password.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-name">Display name</Label>
          <Input
            id="pp-name"
            placeholder="Eli '27"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => persistDisplayName(name.trim())}
          />
        </div>
      </div>

      {invitesForMe.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Invites for you</h3>
          <ul className="space-y-2">
            {invitesForMe.map((p) => (
              <li key={p.id} className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {p.hostDisplayName} ({p.hostNetId}) invited you
                  </span>
                  <Badge>{reasonLabel(p.reason)}</Badge>
                  {p.courseCode ? <Badge variant="secondary">{p.courseCode}</Badge> : null}
                </div>
                <PoolMeta pool={p} />
                <div className="flex gap-2">
                  <DebouncedSubmitButton size="sm" onSubmit={() => respond(p, true)}>
                    <Check className="size-3.5" />
                    Accept
                  </DebouncedSubmitButton>
                  <DebouncedSubmitButton size="sm" variant="outline" onSubmit={() => respond(p, false)}>
                    <X className="size-3.5" />
                    Decline
                  </DebouncedSubmitButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mine.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Your private pools</h3>
          <ul className="space-y-2">
            {mine.map((p) => {
              const pending = p.inviteeNetIds.filter(
                (n) => !p.members.some((m) => m.netId === n) && !p.declinedNetIds.includes(n),
              );
              return (
                <li key={p.id} className="space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {p.hostDeviceId === deviceId ? "You host" : `${p.hostDisplayName} hosts`}
                    </span>
                    <Badge>{reasonLabel(p.reason)}</Badge>
                    {p.courseCode ? <Badge variant="secondary">{p.courseCode}</Badge> : null}
                  </div>
                  <PoolMeta pool={p} />
                  <div className="flex flex-wrap gap-1.5">
                    {p.members.map((m) => (
                      <Badge key={m.deviceId} variant="secondary">
                        {m.displayName} · {m.netId}
                      </Badge>
                    ))}
                    {pending.map((n) => (
                      <Badge key={n} variant="outline" className="border-dashed">
                        {n} · invited
                      </Badge>
                    ))}
                    {p.declinedNetIds.map((n) => (
                      <Badge key={n} variant="outline" className="line-through opacity-60">
                        {n}
                      </Badge>
                    ))}
                  </div>
                  {p.hostDeviceId === deviceId ? (
                    <Button size="sm" variant="ghost" onClick={() => cancel(p)}>
                      Cancel pool
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {open ? (
        <div className="grid gap-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="pp-invitees">Invite NetIDs</Label>
            <Input
              id="pp-invitees"
              placeholder="xyz789, def456"
              value={invitees}
              onChange={(e) => setInvitees(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pp-reason">Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as PrivatePoolReason)}>
                <SelectTrigger id="pp-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIVATE_POOL_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-course">Course (optional)</Label>
              <Select value={course} onValueChange={setCourse}>
                <SelectTrigger id="pp-course" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.courseCode} value={c.courseCode}>
                      {c.courseCode}
                    </SelectItem>
                  ))}
                  {defaultCourseCode && !courses.some((c) => c.courseCode === defaultCourseCode) ? (
                    <SelectItem value={defaultCourseCode}>{defaultCourseCode}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-spot">Where (optional)</Label>
              <Select value={spot} onValueChange={setSpot}>
                <SelectTrigger id="pp-spot" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Decide later</SelectItem>
                  {STUDY_SPOTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp-start">When</Label>
              <Input
                id="pp-start"
                type="datetime-local"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-note">Note (optional)</Label>
            <Textarea
              id="pp-note"
              rows={2}
              placeholder="Bring the draft. I'll grab the room."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <DebouncedSubmitButton onSubmit={create}>
              <UserPlus className="size-3.5" />
              Send invites
            </DebouncedSubmitButton>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <UserPlus className="size-3.5" />
          Invite a partner
        </Button>
      )}

      {error || pollError ? (
        <p className="text-sm text-destructive">{error || pollError}</p>
      ) : null}
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => void refresh()}
      >
        Refresh invites
      </button>
    </section>
  );
}

function PoolMeta({ pool }: { pool: PrivatePool }) {
  if (!pool.spotName && !pool.start && !pool.note) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
      {pool.spotName ? (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {pool.bookingUrl ? (
            <a href={pool.bookingUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
              {pool.spotName}
            </a>
          ) : (
            pool.spotName
          )}
        </span>
      ) : null}
      {pool.start ? (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" />
          {formatWhen(pool.start)}
        </span>
      ) : null}
      {pool.note ? <span className="italic">“{pool.note}”</span> : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoModeButton } from "@/components/landing/DemoModeButton";

export function LandingHero() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Yale study pooling
        </p>
        <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Assemble your week, then book the closest open room.
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          Drop in a CourseTable calendar and a Google Calendar export. StudySpace
          merges them (GCal wins), suggests a nearby coffee shop or Bass Library
          room, and lets you join a study pool — no Canvas, no OAuth, no Yale
          password.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link href="/connect">Connect schedule</Link>
          </Button>
          <DemoModeButton />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>CourseTable + GCal</CardTitle>
            <CardDescription>
              Upload two .ics files or paste calendar text. Google Calendar events
              override CourseTable when they collide.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Peer study pools</CardTitle>
            <CardDescription>
              Join or host a 1–4 person pool by course code. Demo rows are labeled
              [Demo Sample].
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardContent className="pt-0">
            <CardHeader className="px-0">
              <CardTitle>Least walking</CardTitle>
              <CardDescription>
                Coffee first when it is close; otherwise a Yale room at
                schedule.yale.edu/space/36623.
              </CardDescription>
            </CardHeader>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

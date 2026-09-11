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
          Assemble your week, then walk to the nearest reservable room.
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          Drop in a CourseTable calendar and a Google Calendar export. StudySpace
          merges them (GCal wins), ranks reservable Yale rooms by walk time from
          your next class, and opens that room&apos;s schedule.yale.edu page.
          Yale shows live availability. Join a pool with people in the same
          class — no Canvas, no OAuth, no Yale password.
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
                Ranks reservable rooms by walking time and sends you to the
                Yale page for the nearest one. Availability is live on Yale&apos;s
                site, not claimed here.
              </CardDescription>
            </CardHeader>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { BrowseGallery } from "@/components/landing/BrowseGallery";
import { HeroField } from "@/components/landing/HeroField";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <div className="relative flex w-full flex-col pb-20">
      <HeroField />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-16 pb-8 sm:pt-24">
        <div className="max-w-2xl space-y-5">
          <p className="text-sm font-medium tracking-wide text-foreground/55 uppercase">
            Yale study pooling
          </p>
          <h1 className="font-heading text-5xl sm:text-6xl">
            Assemble your week, then walk to the nearest reservable room.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            Drop in a CourseTable calendar and a Google Calendar export. YaleBooking
            merges them (GCal wins), ranks reservable Yale rooms by walk time from
            your next class, and opens that room&apos;s schedule.yale.edu page.
            Yale shows live availability. Join a pool with people in the same
            class — no Canvas, no OAuth, no Yale password.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button size="lg" asChild>
              <Link href="/connect">Add your week</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="relative z-10">
        <BrowseGallery />
      </div>
    </div>
  );
}

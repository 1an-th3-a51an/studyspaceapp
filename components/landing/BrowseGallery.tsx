"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DESTINATIONS = [
  {
    href: "/connect",
    label: "Connect",
    caption: "Bring your calendars",
    index: "01",
    mark: "calendar" as const,
    width: "w-[18.5rem] sm:w-[21rem]",
    tone: "bg-[#1c1814] text-[#f2eadf]",
  },
  {
    href: "/schedule",
    label: "Schedule",
    caption: "See it together",
    index: "02",
    mark: "hours" as const,
    width: "w-[20.5rem] sm:w-[23.5rem]",
    tone: "bg-[#c24e2d] text-[#f7efe6]",
  },
  {
    href: "/pools",
    label: "Pools",
    caption: "Sit with classmates",
    index: "03",
    mark: "seats" as const,
    width: "w-[17rem] sm:w-[19rem]",
    tone: "bg-[#3d4a31] text-[#e7eedc]",
  },
  {
    href: "/rooms",
    label: "Rooms",
    caption: "Closest first",
    index: "04",
    mark: "door" as const,
    width: "w-[18rem] sm:w-[20.5rem]",
    tone: "bg-[#d6b07a] text-[#1c1814]",
  },
  {
    href: "/tune",
    label: "Tune",
    caption: "Set how you study",
    index: "05",
    mark: "tune" as const,
    width: "w-[16.5rem] sm:w-[19rem]",
    tone: "bg-[#5a2c24] text-[#f2eadf]",
  },
] as const;

type CardPhysics = {
  scale: number;
  scaleV: number;
  lift: number;
  liftV: number;
};

function emptyPhysics(): CardPhysics[] {
  return DESTINATIONS.map(() => ({
    scale: 1,
    scaleV: 0,
    lift: 0,
    liftV: 0,
  }));
}

export function BrowseGallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const maxShiftRef = useRef(0);
  const targetRef = useRef(0);
  const shiftRef = useRef(0);
  const velRef = useRef(0);
  const hoverRef = useRef(-1);
  const physicsRef = useRef<CardPhysics[]>(emptyPhysics());
  const [mode, setMode] = useState<"pinned" | "native">("native");

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setMode(motion.matches ? "native" : "pinned");
    };
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!section || !pin || !viewport || !track) return;

    const measure = () => {
      const overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);
      maxShiftRef.current = overflow;
      if (mode === "pinned" && overflow > 0) {
        const travel = Math.max(
          overflow * 2.2,
          Math.round(window.innerHeight * 1.15),
        );
        section.style.height = `${pin.offsetHeight + travel}px`;
      } else {
        section.style.height = "auto";
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mode]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || mode !== "pinned") {
      hoverRef.current = -1;
      physicsRef.current = emptyPhysics();
      return;
    }

    const cards = Array.from(track.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    const exits: Array<() => void> = [];

    cards.forEach((card, index) => {
      const enter = () => {
        hoverRef.current = index;
      };
      const leave = () => {
        if (hoverRef.current === index) hoverRef.current = -1;
      };
      card.addEventListener("pointerenter", enter);
      card.addEventListener("pointerleave", leave);
      exits.push(() => {
        card.removeEventListener("pointerenter", enter);
        card.removeEventListener("pointerleave", leave);
      });
    });

    const clear = () => {
      hoverRef.current = -1;
    };
    track.addEventListener("pointerleave", clear);
    exits.push(() => track.removeEventListener("pointerleave", clear));

    let last = performance.now();
    let frame = 0;
    const stiffness = 58;
    const damping = 11.5;
    const hoverK = 96;
    const hoverD = 13;

    const readTarget = () => {
      const section = sectionRef.current;
      const pin = pinRef.current;
      if (!section || !pin) return;
      const range = Math.max(1, section.offsetHeight - pin.offsetHeight);
      const progress = Math.min(
        1,
        Math.max(0, -section.getBoundingClientRect().top / range),
      );
      targetRef.current = progress * maxShiftRef.current;
    };

    const poseCards = (dt: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const mid =
        viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      const width = Math.max(1, viewport.clientWidth);
      const hovered = hoverRef.current;

      cards.forEach((card, index) => {
        const box = card.getBoundingClientRect();
        const n = (box.left + box.width / 2 - mid) / width;
        const tiltY = n * 22;
        const rot = n * 3.2;
        const active = hovered === index;
        const scaleT = active ? 1.06 : 1;
        const liftT = active ? -15 : 0;
        const p = physicsRef.current[index];
        p.scaleV += ((scaleT - p.scale) * hoverK - p.scaleV * hoverD) * dt;
        p.liftV += ((liftT - p.lift) * hoverK - p.liftV * hoverD) * dt;
        p.scale += p.scaleV * dt;
        p.lift += p.liftV * dt;
        const rise = Math.max(0, (p.scale - 1) / 0.06);
        const visual = card.firstElementChild;
        if (visual instanceof HTMLElement) {
          visual.style.transform = `translate3d(0, ${tiltY + p.lift}px, 0) rotate(${rot}deg) scale(${p.scale})`;
          visual.style.boxShadow = `0 ${10 * rise}px ${22 * rise}px rgba(28, 22, 16, ${0.22 * rise})`;
        }
        card.style.zIndex = active ? "4" : "1";
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      readTarget();
      const x = shiftRef.current;
      const target = targetRef.current;
      let v = velRef.current;
      v += ((target - x) * stiffness - v * damping) * dt;
      const next = x + v * dt;
      shiftRef.current = next;
      velRef.current = v;
      track.style.transform = `translate3d(${-next}px, 0, 0)`;
      poseCards(dt);
      frame = window.requestAnimationFrame(tick);
    };

    readTarget();
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      exits.forEach((fn) => fn());
    };
  }, [mode]);

  const pinned = mode === "pinned";

  return (
    <section
      ref={sectionRef}
      aria-label="Browse YaleBooking"
      className="relative mt-6"
    >
      <div
        ref={pinRef}
        className={cn(
          "flex flex-col justify-center gap-8",
          pinned && "sticky top-16 z-0 min-h-[calc(100svh-4rem)] py-8 sm:py-10",
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <p className="text-[11px] tracking-[0.28em] text-foreground/45 uppercase">
            Index
          </p>
          <h2 className="mt-3 font-heading text-4xl sm:text-5xl">
            Look around.
          </h2>
        </div>

        <div className="relative">
          <div
            ref={viewportRef}
            className={cn(
              "browse-fade relative",
              pinned
                ? "overflow-hidden"
                : "overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            <div
              ref={trackRef}
              className="flex w-max items-end gap-5 px-[8vw] py-14 will-change-transform sm:gap-7"
            >
              {DESTINATIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative h-[22rem] shrink-0 sm:h-[24rem]",
                    item.width,
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 flex flex-col justify-between overflow-visible p-6 origin-[center_70%] sm:p-7",
                      item.tone,
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-heading text-sm tracking-tight opacity-70">
                        {item.index}
                      </span>
                      <CardStamp mark={item.mark} />
                    </span>
                    <span>
                      <span className="font-heading pr-1 text-[2.15rem] leading-none tracking-tight whitespace-nowrap sm:text-[2.55rem]">
                        {item.label}
                      </span>
                      <span className="mt-4 block max-w-[12rem] text-sm leading-5 opacity-75">
                        {item.caption}
                      </span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div aria-hidden className="browse-edge browse-edge-left" />
          <div aria-hidden className="browse-edge browse-edge-right" />
        </div>
      </div>
    </section>
  );
}

function CardStamp({
  mark,
}: {
  mark: (typeof DESTINATIONS)[number]["mark"];
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8 shrink-0 opacity-[0.52]"
      fill="none"
      aria-hidden
    >
      {mark === "calendar" ? (
        <>
          <rect
            x="5"
            y="8"
            width="22"
            height="18"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.35"
          />
          <path d="M5 13.5h22M11 5.5v5M21 5.5v5" stroke="currentColor" strokeWidth="1.35" />
        </>
      ) : null}
      {mark === "hours" ? (
        <>
          <circle cx="16" cy="16" r="10.2" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M16 16V9.2M16 16l6.1 2.4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="1.15" fill="currentColor" />
        </>
      ) : null}
      {mark === "seats" ? (
        <>
          <circle cx="9.6" cy="9.4" r="3.2" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M3.8 24.6c0-4.4 2.5-7 5.8-7s5.8 2.6 5.8 7"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="22.4" cy="9.4" r="3.2" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M16.6 24.6c0-4.4 2.5-7 5.8-7s5.8 2.6 5.8 7"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </>
      ) : null}
      {mark === "door" ? (
        <>
          <rect
            x="8"
            y="4.5"
            width="16"
            height="23"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.35"
          />
          <circle cx="20.2" cy="16.5" r="1.15" fill="currentColor" />
        </>
      ) : null}
      {mark === "tune" ? (
        <>
          <path
            d="M6 9.5h20M6 16h20M6 22.5h20"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <circle cx="12" cy="9.5" r="2.1" fill="currentColor" />
          <circle cx="20" cy="16" r="2.1" fill="currentColor" />
          <circle cx="11" cy="22.5" r="2.1" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

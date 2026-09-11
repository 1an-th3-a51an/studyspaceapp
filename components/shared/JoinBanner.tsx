"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import {
  JOIN_BANNER_EVENT,
  JOIN_BANNER_MS,
  takePendingJoin,
  type JoinBannerPayload,
} from "@/lib/joinBanner";

/**
 * Mounted once in the root layout so a pool join is visible from any page.
 * Covers the top sixth of the viewport for two seconds, then leaves.
 */
export function JoinBanner() {
  const [payload, setPayload] = useState<JoinBannerPayload | null>(null);

  useEffect(() => {
    let hideTimer: number | undefined;

    const show = (next: JoinBannerPayload) => {
      setPayload(next);
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setPayload(null), JOIN_BANNER_MS);
    };

    // A join that navigated here left its announcement in sessionStorage.
    const pending = takePendingJoin();
    if (pending) show(pending);

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<JoinBannerPayload>).detail;
      if (detail?.title) show(detail);
    };
    window.addEventListener(JOIN_BANNER_EVENT, onAnnounce);
    return () => {
      window.removeEventListener(JOIN_BANNER_EVENT, onAnnounce);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!payload) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex h-[16.6667vh] min-h-20 items-center justify-center bg-primary px-6 text-primary-foreground shadow-lg motion-safe:animate-in motion-safe:slide-in-from-top motion-safe:duration-200"
    >
      <div className="flex items-center gap-3 text-center">
        <PartyPopper className="size-6 shrink-0" aria-hidden />
        <div>
          <p className="font-heading text-lg font-semibold sm:text-xl">
            {payload.title}
          </p>
          {payload.detail ? (
            <p className="text-sm opacity-90">{payload.detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

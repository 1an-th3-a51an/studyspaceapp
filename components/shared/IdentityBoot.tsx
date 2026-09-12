"use client";

import { useEffect, useRef } from "react";
import { subscribeToCourses } from "@/lib/hooks/subscribe";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSchedule } from "@/lib/hooks/useSchedule";
import {
  ensureDeviceId,
  getDisplayName,
  getNotifyOptOut,
  NOTIFY_OPT_OUT_EVENT,
} from "@/lib/identity";

/**
 * Boot local identity, then keep signed-in Yale classmates registered for
 * the courses on their imported schedule so booking announcements can reach
 * them without the optional Connect subscribe form.
 */
export function IdentityBoot() {
  const { user, ready: authReady } = useAuth();
  const schedule = useSchedule();
  const lastSynced = useRef("");
  const generation = useRef(0);

  useEffect(() => {
    ensureDeviceId();
  }, []);

  useEffect(() => {
    const bump = () => {
      generation.current += 1;
      lastSynced.current = "";
    };
    window.addEventListener(NOTIFY_OPT_OUT_EVENT, bump);
    return () => window.removeEventListener(NOTIFY_OPT_OUT_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!authReady || !schedule.ready) return;
    if (!user?.email) return;
    if (getNotifyOptOut()) return;
    const codes = schedule.courses.map((c) => c.courseCode);
    if (codes.length === 0) return;
    const stamp = `${user.email}:${codes.join("|")}`;
    if (lastSynced.current === stamp) return;
    lastSynced.current = stamp;
    const my = ++generation.current;
    void subscribeToCourses({
      email: user.email,
      courseCodes: codes,
      displayName: getDisplayName() || user.name,
    }).catch(() => {
      if (generation.current === my) lastSynced.current = "";
    });
  }, [authReady, schedule.ready, schedule.courses, user]);

  return null;
}

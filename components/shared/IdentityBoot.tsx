"use client";

import { useEffect } from "react";
import { ensureDeviceId } from "@/lib/identity";

export function IdentityBoot() {
  useEffect(() => {
    ensureDeviceId();
  }, []);
  return null;
}

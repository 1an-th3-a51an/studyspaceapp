"use client";

import { useRouter } from "next/navigation";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { DEMO_DISPLAY_NAME } from "@/lib/demo/handsomeDan";
import { ensureDeviceId, setDemoMode, setDisplayName } from "@/lib/identity";

export function DemoModeButton() {
  const router = useRouter();

  return (
    <DebouncedSubmitButton
      size="lg"
      onSubmit={() => {
        ensureDeviceId();
        setDemoMode(true);
        setDisplayName(DEMO_DISPLAY_NAME);
        router.push("/schedule");
      }}
    >
      Handsome Dan Demo Mode
    </DebouncedSubmitButton>
  );
}

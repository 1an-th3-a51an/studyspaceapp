import { Activity } from "lucide-react";
import type { ActivityEstimate } from "@/lib/activity";

const BAR_COLORS: Record<ActivityEstimate["level"], string> = {
  quiet: "bg-emerald-500",
  moderate: "bg-lime-500",
  busy: "bg-amber-500",
  packed: "bg-red-500",
};

/** Four-bar activity meter with an honest "est." tag. */
export function ActivityMeter({ estimate }: { estimate: ActivityEstimate }) {
  const filled = Math.max(1, Math.round(estimate.value * 4));
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={estimate.detail}
      aria-label={`${estimate.label}, estimated`}
    >
      <Activity className="size-3" />
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-sm ${i <= filled ? BAR_COLORS[estimate.level] : "bg-muted-foreground/25"}`}
            style={{ height: `${4 + i * 2}px` }}
          />
        ))}
      </span>
      <span>{estimate.label}</span>
      <span className="text-[0.65rem] uppercase tracking-wide opacity-70">
        {estimate.source === "estimate+live" ? "est.+live" : "est."}
      </span>
    </span>
  );
}

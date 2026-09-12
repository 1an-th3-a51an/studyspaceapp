"use client";

import { Clock, Hourglass, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { URGENCY_MODES, type RankedSpot, type UrgencyMode } from "@/lib/recommendations";
import { cn } from "@/lib/utils";

const ICONS: Record<UrgencyMode, typeof Zap> = { now: Zap, soon: Clock, flexible: Hourglass };

/**
 * Ride-hailing style tier picker: each tile shows what you would get under
 * that tier right now, so the trade-off is visible before you tap.
 */
export function UrgencyPicker({
  mode,
  onChange,
  picks,
}: {
  mode: UrgencyMode;
  onChange: (mode: UrgencyMode) => void;
  /** Top pick under each tier, for the tile summaries. */
  picks: Partial<Record<UrgencyMode, RankedSpot>>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How soon do you need a seat">
      {URGENCY_MODES.map((tier) => {
        const Icon = ICONS[tier.mode];
        const pick = picks[tier.mode];
        const active = tier.mode === mode;
        return (
          <button
            key={tier.mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(tier.mode)}
            className={cn(
              "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
              active
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "bg-card hover:bg-muted/60",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Icon className="size-4" />
                {tier.label}
              </span>
              {pick ? (
                <Badge variant={active ? "default" : "secondary"} className="tabular-nums">
                  ~{pick.readyInMinutes} min
                </Badge>
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">{tier.tagline}</span>
            {pick ? (
              <span className="truncate text-xs">
                <span className="text-muted-foreground">Top pick: </span>
                {pick.name}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

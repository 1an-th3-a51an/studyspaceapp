import { ExternalLink, MapPin, Megaphone, Navigation } from "lucide-react";
import { ActivityMeter } from "@/components/rooms/ActivityMeter";
import type { ActivityEstimate } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/geo";
import { slotDeepLink, slotRequestForSpot } from "@/lib/libcal";
import type { RankedSpot } from "@/lib/recommendations";
import { findSpot } from "@/lib/spots";

export type CardMatch = {
  /** 0..1 relative similarity to the search query. */
  score: number;
  /** Readable tags the query hit. */
  tags: string[];
};

export function RecommendationCard({
  recommendation,
  primary,
  originLabel,
  match,
  nextSlotIso,
  onBook,
  activity,
}: {
  recommendation: RankedSpot;
  primary?: boolean;
  originLabel?: string;
  match?: CardMatch;
  /** ISO start used only to put `?date=` on the Yale room link. */
  nextSlotIso?: string;
  /** Book (or meet) here and announce it to classmates. */
  onBook?: (spot: RankedSpot) => void;
  /** Estimated busyness right now (labeled as an estimate). */
  activity?: ActivityEstimate;
}) {
  const registrySpot = findSpot(recommendation.name);
  const url =
    registrySpot && nextSlotIso && registrySpot.bookingUrl
      ? slotDeepLink(slotRequestForSpot(registrySpot, nextSlotIso))
      : recommendation.bookingUrl;
  const distance =
    typeof recommendation.distanceMeters === "number"
      ? formatDistance(recommendation.distanceMeters)
      : null;
  const publishedCapacity =
    registrySpot?.capacitySource === "schedule.yale.edu" &&
    typeof registrySpot.capacity === "number"
      ? registrySpot.capacity
      : undefined;

  return (
    <Card className={primary ? "ring-2 ring-primary/30" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{recommendation.name}</CardTitle>
          <Badge variant="secondary">
            {recommendation.kind === "coffee" ? "Coffee" : "Yale room"}
          </Badge>
          {primary ? <Badge>{match ? "Best match" : "Recommended"}</Badge> : null}
          {match ? (
            <Badge variant="outline">{Math.round(match.score * 100)}% match</Badge>
          ) : null}
        </div>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            {recommendation.walkingMinutes} min walk
          </span>
          {distance ? <span>{distance}</span> : null}
          {originLabel ? <span>from {originLabel}</span> : null}
          {activity ? <ActivityMeter estimate={activity} /> : null}
          {recommendation.address ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {recommendation.address}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {match ? (
          <>
            {recommendation.description ? (
              <p className="text-foreground/80">{recommendation.description}</p>
            ) : null}
            {match.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {match.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            {publishedCapacity !== undefined ? (
              <p>
                Yale lists {publishedCapacity}{" "}
                {publishedCapacity === 1 ? "seat" : "seats"} on schedule.yale.edu.
              </p>
            ) : null}
          </>
        ) : (
          <p>{recommendation.reason}.</p>
        )}
        {url ? (
          <p className="text-xs">
            Opens the Yale space page
            {nextSlotIso ? " on this date" : ""}. Live availability is on their
            grid — StudySpace does not claim a slot is free.
          </p>
        ) : (
          <p>No booking page for this spot. Just walk over and announce it.</p>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {recommendation.directionsUrl ? (
          <Button size="sm" variant="secondary" asChild>
            <a
              href={recommendation.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation className="size-3.5" />
              Directions
            </a>
          </Button>
        ) : null}
        {onBook ? (
          <Button size="sm" onClick={() => onBook(recommendation)}>
            <Megaphone className="size-3.5" />
            {url ? "Book & host pool" : "Meet here & host pool"}
          </Button>
        ) : null}
        {url ? (
          <Button size="sm" variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open Yale page
            </a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

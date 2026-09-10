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
import type { StudyRecommendation } from "@/lib/types";

export function RecommendationCard({
  recommendation,
  primary,
  recurring,
}: {
  recommendation: StudyRecommendation;
  primary?: boolean;
  recurring: boolean;
}) {
  const url = recommendation.bookingUrl;

  return (
    <Card className={primary ? "ring-2 ring-primary/30" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{recommendation.name}</CardTitle>
          <Badge variant="secondary">
            {recommendation.kind === "coffee" ? "Coffee" : "Yale room"}
          </Badge>
          {primary ? <Badge>Primary</Badge> : null}
        </div>
        <CardDescription>
          {recommendation.walkingMinutes} min walk
          {recurring ? " · recurring autobook checked (UI only)" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {url
          ? "Opens the Yale scheduling page. Autobook is a stub until Person 2/3 land booking APIs."
          : "No booking URL on this sample. Use it as a walk-over suggestion."}
      </CardContent>
      <CardFooter className="gap-2">
        {url ? (
          <Button size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Autofill timeslot
            </a>
          </Button>
        ) : (
          <Button size="sm" disabled>
            Autofill timeslot
          </Button>
        )}
        <Button size="sm" variant="outline" disabled>
          Autobook — hook pending
        </Button>
      </CardFooter>
    </Card>
  );
}

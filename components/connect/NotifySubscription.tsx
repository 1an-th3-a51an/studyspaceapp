"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { similarCourses } from "@/lib/courseSimilarity";
import { subscribeToCourses, unsubscribeEmail } from "@/lib/hooks/subscribe";
import { useSchedule } from "@/lib/hooks/useSchedule";
import { getDisplayName, getNotifyEmail, setNotifyEmail } from "@/lib/identity";

/**
 * Opt in to booking announcements.
 *
 * The app has no Yale directory and no OAuth, so "email everyone in the class"
 * has to mean "everyone who listed this course and left an address". This is
 * where they leave it.
 */
export function NotifySubscription() {
  const schedule = useSchedule();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setEmail(getNotifyEmail()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const courses = schedule.courses.map((c) => c.courseCode);
  const adjacent = Array.from(
    new Set(courses.flatMap((c) => similarCourses(c, 3).map((s) => s.courseCode))),
  ).filter((c) => !courses.includes(c));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="notify-email">Email for booking announcements</Label>
        <Input
          id="notify-email"
          type="email"
          inputMode="email"
          placeholder="you@yale.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {courses.length > 0 ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            You will be emailed when someone books a room for:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {courses.map((code) => (
              <Badge key={code} variant="secondary">
                {code}
              </Badge>
            ))}
            {adjacent.map((code) => (
              <Badge key={code} variant="outline" title="Adjacent course">
                {code}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Connect a calendar above first — subscriptions follow the courses on
          your schedule.
        </p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {mailConfigured === false ? (
        <p className="text-sm text-muted-foreground">
          This server has no mail provider configured, so announcements are
          written to the server log instead of delivered. Set{" "}
          <code>RESEND_API_KEY</code> and <code>MAIL_FROM</code> to send them.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <DebouncedSubmitButton
          disabled={courses.length === 0}
          onSubmit={async () => {
            setError("");
            setStatus("");
            try {
              const result = await subscribeToCourses({
                email,
                displayName: getDisplayName() || undefined,
                courseCodes: courses,
              });
              setNotifyEmail(result.email);
              setMailConfigured(result.mailConfigured);
              setStatus(
                `Subscribed ${result.email} to ${result.courses.length} course${result.courses.length === 1 ? "" : "s"}.`,
              );
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not subscribe");
            }
          }}
        >
          <Mail className="size-3.5" />
          Subscribe
        </DebouncedSubmitButton>
        <Button
          variant="outline"
          disabled={!email.trim()}
          onClick={async () => {
            setError("");
            setStatus("");
            try {
              const result = await unsubscribeEmail(email);
              setNotifyEmail("");
              setStatus(`Removed ${result.removed} subscription(s).`);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not unsubscribe");
            }
          }}
        >
          Unsubscribe
        </Button>
      </div>
    </div>
  );
}

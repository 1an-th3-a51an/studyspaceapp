"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { DebouncedSubmitButton } from "@/components/shared/DebouncedSubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { similarCourses } from "@/lib/courseSimilarity";
import { useAuth } from "@/lib/hooks/useAuth";
import { subscribeToCourses, unsubscribeEmail } from "@/lib/hooks/subscribe";
import { useSchedule } from "@/lib/hooks/useSchedule";
import {
  getDisplayName,
  getNotifyEmail,
  setNotifyEmail,
  setNotifyOptOut,
} from "@/lib/identity";

/**
 * Opt in (or out) of booking announcement email.
 *
 * Signed-in Yale accounts with this course on their schedule are already
 * classmates for announcements. This form is an extra address, or Unsubscribe.
 * Related catalog courses are matched on the server when someone books — they
 * are not sent as extra subscribe codes.
 */
export function NotifySubscription() {
  const schedule = useSchedule();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmail(getNotifyEmail() || user?.email || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.email]);

  const courses = schedule.courses.map((c) => c.courseCode);
  const similar = Array.from(
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
            You will be emailed when someone books a room for your courses.
            Closely related catalog listings are included automatically.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {courses.map((code) => (
              <Badge key={code} variant="secondary">
                {code}
              </Badge>
            ))}
            {similar.map((code) => (
              <Badge key={code} variant="outline" title="Similar catalog description">
                {code}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Connect a calendar above first — announcements follow the courses on
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
              setNotifyOptOut(false);
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
          disabled={!email.trim() && !user?.email}
          onClick={async () => {
            setError("");
            setStatus("");
            try {
              setNotifyOptOut(true);
              const result = await unsubscribeEmail(email.trim() || user?.email || "");
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

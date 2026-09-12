"use client";

import Link from "next/link";
import { CourseTableExportHelp } from "@/components/connect/CourseTableExportHelp";
import { IcsDropzone } from "@/components/connect/IcsDropzone";
import { NameForm } from "@/components/connect/NameForm";
import { NotifySubscription } from "@/components/connect/NotifySubscription";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ConnectPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl">
          Add your week
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Just a name, like when2meet, or sign in with your Yale Google account.
          CourseTable access is via .ics export — this app never collects a Yale
          password and never talks to Canvas.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Who you are</CardTitle>
          <CardDescription>
            Shown to classmates on pools and bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm />
        </CardContent>
      </Card>
      <CourseTableExportHelp />
      <div className="grid gap-4 md:grid-cols-2">
        <IcsDropzone label="Google Calendar .ics" source="gcal" />
        <IcsDropzone label="CourseTable .ics" source="coursetable-ics" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Booking announcements</CardTitle>
          <CardDescription>
            Signed-in Yale accounts with these courses on their schedule are
            emailed when a classmate books a room. Use this form for an extra
            address, or to unsubscribe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotifySubscription />
        </CardContent>
      </Card>
      <Button asChild>
        <Link href="/schedule">Open merged schedule</Link>
      </Button>
    </div>
  );
}

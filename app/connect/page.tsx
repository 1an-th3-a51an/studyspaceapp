"use client";

import Link from "next/link";
import { CourseTableExportHelp } from "@/components/connect/CourseTableExportHelp";
import { IcsDropzone } from "@/components/connect/IcsDropzone";
import { NetIdForm } from "@/components/connect/NetIdForm";
import { TextPasteFallback } from "@/components/connect/TextPasteFallback";
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
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Connect your schedule
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          NetID is optional and local. CourseTable access is via .ics export —
          this app never collects a Yale password and never talks to Canvas.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            A deviceId UUID is created in localStorage on first visit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NetIdForm />
        </CardContent>
      </Card>
      <CourseTableExportHelp />
      <div className="grid gap-4 md:grid-cols-2">
        <IcsDropzone label="Google Calendar .ics" source="gcal" />
        <IcsDropzone label="CourseTable .ics" source="coursetable-ics" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Text-paste fallback</CardTitle>
          <CardDescription>
            If you cannot upload a file, paste ICS or timestamped lines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TextPasteFallback />
        </CardContent>
      </Card>
      <Button asChild>
        <Link href="/schedule">Open merged schedule</Link>
      </Button>
    </div>
  );
}

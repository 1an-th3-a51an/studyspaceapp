import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  "Open CourseTable and sign in with your Yale account in the browser (not this app).",
  "Go to Workbench → Calendar.",
  "Choose Export and download the .ics file.",
  "Drop that file into the CourseTable .ics zone below. Optionally export Google Calendar the same way — GCal wins on conflicts.",
];

export function CourseTableExportHelp() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export .ics from CourseTable</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

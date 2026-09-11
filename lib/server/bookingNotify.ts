import { similarCourses } from "@/lib/courseSimilarity";
import { sendMail } from "@/lib/server/mailer";
import { findSpot } from "@/lib/spots";
import type { BookingNotifyResult, CourseSubscription, RoomBooking } from "@/lib/types";

/**
 * Who hears about a booking: the host's class first, then adjacent classes
 * from the course-similarity graph.
 *
 * This is opt-in rather than a class roster. The app has no Yale directory
 * access and no OAuth, so "everyone in the class" means everyone who put that
 * course on their schedule and gave the app an address to write to.
 */
export function bookingAudience(courseCode: string): string[] {
  return [courseCode, ...similarCourses(courseCode).map((c) => c.courseCode)];
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function composeBookingEmail(booking: RoomBooking): {
  subject: string;
  text: string;
} {
  const spot = findSpot(booking.spotName);
  const seatsLeft = Math.max(0, booking.capacity - booking.members.length);
  const lines = [
    `${booking.hostDisplayName} booked ${booking.spotName} for ${booking.courseCode}.`,
    "",
    `When: ${formatWhen(booking.start)} (Eastern)`,
    `Where: ${booking.spotName}${spot?.address ? `, ${spot.address}` : ""}`,
    `Seats: ${booking.capacity} total, ${seatsLeft} still open`,
  ];
  if (booking.capacityNote) lines.push(`Note: ${booking.capacityNote}`);
  if (booking.bookingUrl) lines.push(`Room page: ${booking.bookingUrl}`);
  lines.push(
    "",
    `Say you are coming on the Pools page: /pools?course=${encodeURIComponent(booking.courseCode)}`,
    "",
    "You are getting this because you subscribed to booking announcements for",
    "this course or a closely related one in StudySpace.",
  );

  return {
    subject: `${booking.courseCode}: ${booking.spotName} at ${formatWhen(booking.start)}`,
    text: lines.join("\n"),
  };
}

/** Email a booking to everyone subscribed to its course or an adjacent one. */
export async function notifyBooking(
  booking: RoomBooking,
  subscribers: CourseSubscription[],
): Promise<BookingNotifyResult> {
  const courses = bookingAudience(booking.courseCode);
  const allowed = new Set(courses);
  // Never email the host their own announcement.
  const recipients = Array.from(
    new Set(
      subscribers
        .filter((s) => allowed.has(s.courseCode) && s.deviceId !== booking.deviceId)
        .map((s) => s.email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  const { subject, text } = composeBookingEmail(booking);
  const result = await sendMail({ recipients, subject, text });

  return {
    recipients: recipients.length,
    courses: courses.filter((code) =>
      subscribers.some((s) => s.courseCode === code),
    ),
    delivery: result.delivery,
    detail: result.detail,
  };
}

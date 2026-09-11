import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { IdentityBoot } from "@/components/shared/IdentityBoot";
import { SiteNav } from "@/components/shared/SiteNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudySpace",
  description:
    "Merge CourseTable and Google Calendar, join study pools, and pick the nearest open Yale room.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <IdentityBoot />
        <SiteNav />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}

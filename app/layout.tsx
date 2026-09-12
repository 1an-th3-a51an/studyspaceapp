import type { Metadata } from "next";
import { Bricolage_Grotesque, Syne } from "next/font/google";
import { IdentityBoot } from "@/components/shared/IdentityBoot";
import { JoinBanner } from "@/components/shared/JoinBanner";
import { SiteNav } from "@/components/shared/SiteNav";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
  weight: ["400", "600", "700", "800"],
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
  weight: "variable",
});

export const metadata: Metadata = {
  title: "YaleBooking",
  description:
    "Find a room nearby and people with the same hours. Import your calendar and we’ll match the open slots to a study space.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <IdentityBoot />
        <JoinBanner />
        <SiteNav />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}

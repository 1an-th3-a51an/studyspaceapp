"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KarmaBadge } from "@/components/shared/KarmaBadge";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/connect", label: "Connect" },
  { href: "/schedule", label: "Schedule" },
  { href: "/pools", label: "Pools" },
  { href: "/rooms", label: "Rooms" },
  { href: "/tune", label: "Tune" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-heading text-base font-semibold tracking-tight">
          StudySpace
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <span className="ml-1">
            <KarmaBadge />
          </span>
        </nav>
      </div>
    </header>
  );
}

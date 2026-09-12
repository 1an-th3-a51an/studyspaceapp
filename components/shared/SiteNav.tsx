"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KarmaBadge } from "@/components/shared/KarmaBadge";
import { SignInButton } from "@/components/shared/SignInButton";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/connect", label: "Connect" },
  { href: "/schedule", label: "Schedule" },
  { href: "/pools", label: "Pools" },
  { href: "/rooms", label: "Rooms" },
  { href: "/tune", label: "Tune" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/80 backdrop-blur-xl">
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="YaleBooking"
          className="inline-flex h-16 min-w-0 items-center justify-self-start"
        >
          <Image
            src="/yalebooking-logo.png"
            alt="YaleBooking"
            width={783}
            height={183}
            priority
            unoptimized
            className="h-8 w-auto object-contain object-left sm:h-10"
            style={{ width: "auto" }}
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center justify-self-center gap-7 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={pathname.startsWith(link.href)}
            />
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-2 sm:gap-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="text-[12px] tracking-[0.16em] text-foreground/70 uppercase transition-colors hover:text-foreground md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
          <KarmaBadge />
          <SignInButton />
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-foreground/10 bg-background md:hidden"
        >
          <ul className="mx-auto flex max-w-6xl flex-col px-6 py-3">
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center py-3 text-[17px] tracking-[0.04em] text-foreground/55 transition-colors",
                      active && "text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative py-1 text-[15px] tracking-[0.06em] text-foreground/55 transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 -bottom-1 mx-auto h-px w-full origin-center bg-foreground transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </Link>
  );
}

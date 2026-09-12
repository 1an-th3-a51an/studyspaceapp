"use client";

import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/useAuth";

export function SignInButton() {
  const { user, ready, busy, error, configured, signIn, signOut } = useAuth();
  if (!configured || !ready) return null;

  if (user) {
    return (
      <span className="inline-flex items-center gap-2">
        {user.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoUrl} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
        ) : null}
        <span className="hidden text-xs text-muted-foreground sm:inline" title={user.email}>
          {user.name}
        </span>
        <Button size="sm" variant="ghost" onClick={signOut} disabled={busy} title="Sign out">
          <LogOut className="size-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button size="sm" variant="outline" onClick={signIn} disabled={busy}>
        <LogIn className="size-3.5" />
        {busy ? "Signing in…" : "Sign in with Yale"}
      </Button>
      {error ? <span className="max-w-64 text-right text-[0.7rem] text-destructive">{error}</span> : null}
    </span>
  );
}

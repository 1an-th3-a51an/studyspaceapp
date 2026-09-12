"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/hooks/useAuth";
import { getDisplayName, setDisplayName } from "@/lib/identity";

/** Like when2meet: just a name. Google sign-in fills it in for you. */
export function NameForm() {
  const [name, setName] = useState("");
  const { user, configured, signIn, busy } = useAuth();

  useEffect(() => {
    const timer = window.setTimeout(() => setName(getDisplayName()), 0);
    return () => window.clearTimeout(timer);
  }, [user?.uid]);

  return (
    <div className="space-y-2">
      <Label htmlFor="display-name">Your name</Label>
      <Input
        id="display-name"
        autoComplete="name"
        placeholder="Eli '27"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setDisplayName(event.target.value);
        }}
      />
      <p className="text-xs text-muted-foreground">
        {user
          ? `Signed in as ${user.email}. Your pools and bookings follow you across devices.`
          : configured
            ? "Stored in this browser. Or sign in with your Yale Google account so it follows you everywhere."
            : "Stored in this browser. No password, ever."}
      </p>
      {!user && configured ? (
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="text-xs underline underline-offset-4 hover:text-foreground"
        >
          {busy ? "Signing in…" : "Sign in with Yale"}
        </button>
      ) : null}
    </div>
  );
}

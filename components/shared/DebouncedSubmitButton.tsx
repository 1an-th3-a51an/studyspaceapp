"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

export function DebouncedSubmitButton({
  onSubmit,
  validate,
  disabled,
  children,
  ...rest
}: ButtonProps & {
  onSubmit: () => void | Promise<void>;
  validate?: () => boolean;
}) {
  const [locked, setLocked] = useState(false);
  const [inFlight, setInFlight] = useState(false);

  async function handleClick() {
    if (locked || inFlight || disabled) return;
    if (validate && !validate()) return;
    setLocked(true);
    setInFlight(true);
    const started = Date.now();
    try {
      await onSubmit();
    } finally {
      setInFlight(false);
      const remaining = Math.max(0, 1500 - (Date.now() - started));
      window.setTimeout(() => setLocked(false), remaining);
    }
  }

  return (
    <Button
      {...rest}
      type="button"
      disabled={Boolean(disabled) || locked || inFlight}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}

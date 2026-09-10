const TOKENS = ["fuck", "shit", "bitch", "asshole", "bastard"] as const;

export function failsProfanityCheck(displayName: string): boolean {
  const words = displayName
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .filter(Boolean);
  return words.some((word) =>
    (TOKENS as readonly string[]).includes(word),
  );
}

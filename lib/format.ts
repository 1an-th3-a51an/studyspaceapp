export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatWhen(start)} – ${new Date(end).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

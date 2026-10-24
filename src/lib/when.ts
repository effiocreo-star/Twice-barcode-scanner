import { format, isToday } from "date-fns";

export function formatWhen(ts: number, now = Date.now()) {
  const date = new Date(ts);
  if (now - ts < 45_000) return "just now";
  if (isToday(date)) return format(date, "h:mm a");
  return format(date, "MMM d, h:mm a");
}

export function formatExact(ts: number) {
  return format(new Date(ts), "h:mm:ss a");
}

import { env } from "cloudflare:workers";

/** Check-ins after this local time are late. */
export const WORKDAY_START = "09:00";

export function timeZone(): string {
  const zone = (env as { TIME_ZONE?: string }).TIME_ZONE || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

function parts(date: Date, zone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** YYYY-MM-DD of an instant in the company's time zone. */
export function localDate(date: Date = new Date()): string {
  const p = parts(date, timeZone());
  return `${p.year}-${p.month}-${p.day}`;
}

/** HH:MM of an instant in the company's time zone. */
export function localTime(iso: string): string {
  const p = parts(new Date(iso), timeZone());
  return `${p.hour}:${p.minute}`;
}

/** The instant of a local date and HH:MM in the company's time zone. */
export function toInstant(date: string, time: string): string {
  const zone = timeZone();
  const guess = new Date(`${date}T${time}:00Z`);
  const p = parts(guess, zone);
  const asLocal = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

/** Inclusive count of calendar days between two YYYY-MM-DD dates. */
export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

export function hoursBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 360_000) / 10);
}

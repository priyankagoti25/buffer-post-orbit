/**
 * Date math for recurring posts. Pure functions, no imports, so the same file runs on the server
 * and in the browser (the page shows "next 3 times" using this exact code).
 *
 * A rule says "every N days / weeks on these weekdays / months at HH:mm in a time zone".
 * Occurrence number 0 is the first one on or after `startDate` (a local date like 2026-11-20).
 */
export type Frequency = "daily" | "weekly" | "monthly";
export type Rule = {
  frequency: Frequency;
  interval: number;
  /** 0 = Sunday ... 6 = Saturday. Used for weekly rules only. */
  weekdays: number[];
  /** Local clock time, "HH:mm". */
  time: string;
  /** IANA name, for example "Asia/Kolkata". */
  timezone: string;
};

export type YMD = { y: number; m: number; d: number };

export function parseYmd(s: string): YMD {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
export const formatYmd = ({ y, m, d }: YMD) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const utcDay = ({ y, m, d }: YMD) => Date.UTC(y, m - 1, d);
const fromUtcDay = (ms: number): YMD => {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
export const addDays = (a: YMD, n: number): YMD =>
  fromUtcDay(utcDay(a) + n * 86_400_000);
export const compareYmd = (a: YMD, b: YMD) => utcDay(a) - utcDay(b);
const dayOfWeek = (a: YMD) => new Date(utcDay(a)).getUTCDay();
const daysInMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Same day-of-month `n` months later. Short months use their last day (Jan 31 -> Feb 28). */
function addMonths(start: YMD, n: number): YMD {
  const total = start.y * 12 + (start.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(start.d, daysInMonth(y, m)) };
}

/** Local calendar date of occurrence number `n` (0-based). */
export function localDateOf(rule: Rule, startDate: string, n: number): YMD {
  const start = parseYmd(startDate);
  const interval = Math.max(1, rule.interval);
  if (rule.frequency === "daily") return addDays(start, n * interval);
  if (rule.frequency === "monthly") return addMonths(start, n * interval);

  // Weekly: weeks start on Monday. Every `interval` weeks, on each chosen weekday.
  const days = [...new Set(rule.weekdays)].filter((d) => d >= 0 && d <= 6);
  if (!days.length)
    throw new Error("A weekly rule needs at least one weekday.");
  const order = days.map((d) => (d + 6) % 7).sort((a, b) => a - b); // Monday = 0
  const startWeek = addDays(start, -((dayOfWeek(start) + 6) % 7));
  let count = 0;
  for (let w = 0; w < 20_000; w += interval) {
    for (const offset of order) {
      const date = addDays(startWeek, w * 7 + offset);
      if (compareYmd(date, start) < 0) continue;
      if (count === n) return date;
      count++;
    }
  }
  throw new Error("Recurrence went too far ahead.");
}

/** How far a time zone is ahead of UTC at a given moment, in milliseconds. */
function zoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-20" + "09:30" in Asia/Kolkata -> the real moment in time. */
export function zonedToUtc(date: YMD, time: string, timeZone: string): Date {
  const [hh, mm] = time.split(":").map(Number);
  const target = Date.UTC(date.y, date.m - 1, date.d, hh, mm);
  let utc = target - zoneOffsetMs(timeZone, target);
  utc = target - zoneOffsetMs(timeZone, utc); // second pass fixes days that change clocks
  return new Date(utc);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Buffer refuses the same post on the same channel about a day apart, so repeats must be 2+ days apart. */
export const MIN_GAP_DAYS = 2;

/** Weekdays whose neighbour (the day before or after, Sunday and Monday included) is also chosen. */
export function adjacentWeekdays(days: number[]): boolean {
  const set = new Set(days);
  return days.some((d) => set.has((d + 1) % 7));
}

/** Why a rule cannot be used, or null when it is fine. */
export function ruleProblem(rule: Rule): string | null {
  if (rule.frequency === "daily" && rule.interval < MIN_GAP_DAYS) {
    return "Buffer does not accept the same post on the next day. Repeat every 2 days or more, or use weekly.";
  }
  if (rule.frequency === "weekly" && adjacentWeekdays(rule.weekdays)) {
    return "Pick days that are not next to each other (Sunday and Monday count as neighbours). Buffer does not accept the same post on back-to-back days.";
  }
  return null;
}

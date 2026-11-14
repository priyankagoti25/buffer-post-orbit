// The account's "time format" from Buffer ('12' or '24'). Null means: follow the device.
let timeFormat: "12" | "24" | null = null;

export function setTimeFormat(value: unknown) {
  const s = String(value ?? "").toLowerCase();
  timeFormat = /24|twenty/.test(s) ? "24" : /12|twelve/.test(s) ? "12" : null;
}

const format12h = () =>
  timeFormat
    ? timeFormat === "12"
    : !!new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
      }).resolvedOptions().hour12;

/** 24 hour: "15 Nov 2026, 22:55". 12 hour: "15 Nov 2026, 10:55 PM". */
export function formatDateTime(
  iso: string | null | undefined,
  timeZone?: string | null,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const twelve = format12h();
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hourCycle: twelve ? "h12" : "h23",
        ...(timeZone ? { timeZone } : {}),
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    );
    const time = twelve
      ? `${p.hour}:${p.minute} ${p.dayPeriod}`
      : `${p.hour.padStart(2, "0")}:${p.minute}`;
    return `${p.day} ${p.month} ${p.year}, ${time}`;
  } catch {
    return d.toLocaleString();
  }
}

export function formatDate(iso: string | null | undefined): string {
  const full = formatDateTime(iso);
  return full === "—" ? full : full.split(", ")[0];
}
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [2592000, "month"],
  ];
  let value = seconds / 60;
  let unit = "minute";
  for (const [size, name] of units) {
    if (seconds >= size) {
      value = seconds / size;
      unit = name;
    }
  }
  const n = Math.floor(value);
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** Value for <input type="datetime-local"> in the user's own time zone. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const defaultScheduleTime = () =>
  toLocalInput(new Date(Date.now() + 24 * 3600 * 1000));

export function errorMessage(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };
  return err?.response?.data?.error?.message ?? fallback;
}

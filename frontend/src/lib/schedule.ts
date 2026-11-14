import { defaultScheduleTime } from "./format";
import { ruleProblem, upcomingTimes, type Frequency } from "./recurrence";
import type { RecurringRule } from "../types/buffer";

/** What the person chose in the "when" picker. */
export type ScheduleKind = "queue" | "custom" | "now" | "draft" | "keep";
export type ScheduleValue = { kind: ScheduleKind; dueLocal: string };

export const newSchedule = (kind: ScheduleKind = "queue"): ScheduleValue => ({
  kind,
  dueLocal: defaultScheduleTime(),
});

export type SchedulePayload = {
  mode?: "addToQueue" | "shareNext" | "shareNow" | "customScheduled";
  dueAt?: string;
  saveToDraft?: boolean;
};

/** Turn the picker value into what our API expects. "keep" sends nothing. */
export function scheduleToPayload(v: ScheduleValue): SchedulePayload {
  switch (v.kind) {
    case "queue":
      return { mode: "addToQueue", saveToDraft: false };
    case "now":
      return { mode: "shareNow", saveToDraft: false };
    case "draft":
      return { mode: "addToQueue", saveToDraft: true };
    case "custom":
      return {
        mode: "customScheduled",
        dueAt: new Date(v.dueLocal).toISOString(),
        saveToDraft: false,
      };
    default:
      return {};
  }
}

/** Returns a message when the picker value cannot be used, otherwise null. */
export function scheduleProblem(v: ScheduleValue): string | null {
  if (v.kind !== "custom") return null;
  const t = new Date(v.dueLocal).getTime();
  if (Number.isNaN(t)) return "Pick a date and time.";
  if (t < Date.now() + 60_000) return "Pick a time in the future.";
  return null;
}

// ---------------------------------------------------------------------------
// Repeat
// ---------------------------------------------------------------------------
export type RecurrenceValue = {
  enabled: boolean;
  frequency: Frequency;
  interval: number;
  weekdays: number[];
  end: "never" | "date" | "count";
  endDate: string;
  count: number;
};

export const newRecurrence = (): RecurrenceValue => ({
  enabled: false,
  frequency: "weekly",
  interval: 1,
  weekdays: [],
  end: "never",
  endDate: "",
  count: 10,
});

export const browserZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export type RecurrencePayload = {
  rule: RecurringRule;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
};

/** The first time (from the date picker) plus the repeat settings -> what the server stores. */
export function recurrencePayload(
  dueLocal: string,
  r: RecurrenceValue,
): RecurrencePayload {
  const [startDate, rest = "09:00"] = dueLocal.split("T");
  const weekdays =
    r.frequency === "weekly"
      ? r.weekdays.length
        ? r.weekdays
        : [new Date(dueLocal).getDay()]
      : [];
  return {
    rule: {
      frequency: r.frequency,
      interval: r.interval,
      weekdays,
      time: rest.slice(0, 5),
      timezone: browserZone(),
    },
    startDate,
    endDate: r.end === "date" && r.endDate ? r.endDate : null,
    maxOccurrences: r.end === "count" ? r.count : null,
  };
}

export function recurrenceProblem(
  dueLocal: string,
  r: RecurrenceValue,
  kind: ScheduleKind = "custom",
): string | null {
  if (!r.enabled) return null;
  if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 30)
    return "Repeat every must be between 1 and 30.";
  const rule = ruleProblem({
    frequency: r.frequency,
    interval: r.interval,
    weekdays: r.frequency === "weekly" ? r.weekdays : [],
    time: "00:00",
    timezone: "UTC",
  });
  if (rule) return rule;
  if (kind === "now") {
    try {
      const p = recurrencePayload(dueLocal, r);
      const next = upcomingTimes(
        p.rule,
        p.startDate,
        new Date(Date.now() + 2 * 60_000),
        1,
        { endDate: p.endDate, maxOccurrences: p.maxOccurrences },
      )[0];
      if (next && next.getTime() - Date.now() < 47 * 3_600_000)
        return "The first repeat would be less than 2 days after this post, and Buffer does not accept the same post that close. Pick different days.";
    } catch {
      /* the other checks report it */
    }
  }
  if (r.end === "date" && !r.endDate) return "Pick an end date.";
  if (r.end === "date" && r.endDate < dueLocal.split("T")[0])
    return "The end date is before the first post.";
  if (
    r.end === "count" &&
    (!Number.isInteger(r.count) || r.count < 1 || r.count > 365)
  )
    return "How many times must be between 1 and 365.";
  return null;
}

import { useMemo } from "react";
import { describeRule, upcomingTimes } from "../../lib/recurrence";
import { formatDateTime, toLocalInput } from "../../lib/format";
import {
  recurrencePayload,
  recurrenceProblem,
  type RecurrenceValue,
  type ScheduleKind,
} from "../../lib/schedule";

const DAYS = [
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
  { v: 0, l: "Sun" },
];

type Props = {
  value: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
  /** The time of the first repeat (for "Share now" it is the current time). */
  dueLocal: string;
  kind?: ScheduleKind;
  /** Lets the person pick when the repeats begin (used with "Add to queue"). */
  onStartChange?: (v: string) => void;
  /** When set, the box is switched off and this says why (for example, the limit is reached). */
  blockedReason?: string | null;
};

export default function RecurrenceFields({
  value,
  onChange,
  dueLocal,
  kind = "custom",
  onStartChange,
  blockedReason,
}: Props) {
  const set = (patch: Partial<RecurrenceValue>) =>
    onChange({ ...value, ...patch });
  const problem = recurrenceProblem(dueLocal, value, kind);

  const preview = useMemo(() => {
    if (!value.enabled || problem || Number.isNaN(new Date(dueLocal).getTime()))
      return null;
    try {
      const p = recurrencePayload(dueLocal, value);
      const times = upcomingTimes(p.rule, p.startDate, new Date(), 3, {
        endDate: p.endDate,
        maxOccurrences: p.maxOccurrences,
      });
      return { summary: describeRule(p.rule), times };
    } catch {
      return null;
    }
  }, [value, dueLocal, problem]);

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${value.enabled ? "border-forest-700 bg-sage-50" : "border-line bg-paper"}`}
    >
      <label
        className={`flex items-start gap-3 ${blockedReason ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={value.enabled && !blockedReason}
          disabled={!!blockedReason}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="mt-1 accent-[#17261d]"
        />
        <span>
          <span className="block text-sm font-medium">Repeat this post</span>
          <span className="block text-xs font-medium text-muted">
            This app keeps the next two posts scheduled for you.
          </span>
          <span className="block text-xs font-medium text-muted">
            {blockedReason || "Recurring posts are limit reached."}
          </span>
        </span>
      </label>

      {value.enabled && (
        <div className="mt-4 space-y-4">
          {kind === "now" && (
            <p className="rounded-xl bg-white p-3 text-xs text-muted">
              The post goes out now. After that it repeats at this same time of
              day ({dueLocal.split("T")[1]?.slice(0, 5)}).
            </p>
          )}
          {kind === "queue" && onStartChange && (
            <label className="block text-sm font-medium">
              First repeat
              <input
                type="datetime-local"
                min={toLocalInput(new Date())}
                value={dueLocal}
                onChange={(e) => onStartChange(e.target.value)}
                className="field max-w-xs"
              />
              <span className="mt-1 block text-xs font-normal text-muted">
                The post goes into your queue now. It then repeats from this
                time, at this time of day.
              </span>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Every</span>
            <input
              type="number"
              min={value.frequency === "daily" ? 2 : 1}
              max={30}
              value={value.interval}
              onChange={(e) => set({ interval: Number(e.target.value) })}
              aria-label="Repeat every"
              className="field w-20"
            />
            <select
              value={value.frequency}
              onChange={(e) => {
                const frequency = e.target
                  .value as RecurrenceValue["frequency"];
                set({
                  frequency,
                  interval:
                    frequency === "daily"
                      ? Math.max(2, value.interval)
                      : value.interval,
                });
              }}
              className="field w-auto"
              aria-label="Repeat unit"
            >
              <option value="daily">days (2 or more)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
            </select>
          </div>

          {value.frequency === "weekly" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">
                On these days (leave empty to use the day of the first post).
                Days next to a chosen day are turned off, because Buffer does
                not accept the same post on back-to-back days.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = value.weekdays.includes(d.v);
                  // A day next to a chosen day is off limits (Sunday and Monday are neighbours).
                  const blocked =
                    !on &&
                    (value.weekdays.includes((d.v + 1) % 7) ||
                      value.weekdays.includes((d.v + 6) % 7));
                  return (
                    <button
                      key={d.v}
                      type="button"
                      aria-pressed={on}
                      disabled={blocked}
                      title={
                        blocked
                          ? "Next to a chosen day. Buffer does not accept the same post on back-to-back days."
                          : undefined
                      }
                      onClick={() =>
                        set({
                          weekdays: on
                            ? value.weekdays.filter((x) => x !== d.v)
                            : [...value.weekdays, d.v],
                        })
                      }
                      className={`h-9 w-12 rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-35 ${on ? "bg-forest-900 text-white" : "bg-sage-100 text-forest-800 hover:bg-sage-200"}`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2 text-sm">
            <p className="text-md font-semibold text-muted">Stop </p>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="rec-end"
                checked={value.end === "never"}
                onChange={() => set({ end: "never" })}
                className="accent-[#17261d]"
              />{" "}
              Never (until you cancel)
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="rec-end"
                checked={value.end === "date"}
                onChange={() => set({ end: "date" })}
                className="accent-[#17261d]"
              />{" "}
              On
              <input
                type="date"
                value={value.endDate}
                disabled={value.end !== "date"}
                onChange={(e) => set({ endDate: e.target.value })}
                className="field w-auto"
                aria-label="End date"
              />
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input
                type="radio"
                name="rec-end"
                checked={value.end === "count"}
                onChange={() => set({ end: "count" })}
                className="accent-[#17261d]"
              />{" "}
              After
              <input
                type="number"
                min={1}
                max={365}
                value={value.count}
                disabled={value.end !== "count"}
                onChange={(e) => set({ count: Number(e.target.value) })}
                className="field w-24"
                aria-label="Number of posts"
              />{" "}
              posts
            </label>
          </div>

          {problem && <p className="text-xs text-red-700">{problem}</p>}
          {preview && (
            <div className="rounded-xl bg-white p-3 text-sm">
              <p className="font-medium">{preview.summary}</p>
              {preview.times.length ? (
                <ul className="mt-1 space-y-0.5 text-xs font-medium text-muted">
                  {preview.times.map((t) => (
                    <li key={t.toISOString()}>
                      {formatDateTime(t.toISOString())}
                    </li>
                  ))}
                  {/* {preview.times.map((t) => <li key={t.toISOString()}>{t.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</li>)} */}
                  <li>…and so on</li>
                </ul>
              ) : (
                <p className="mt-1 text-xs text-red-700">
                  No future times match these settings.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

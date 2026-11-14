import { toLocalInput } from "../../lib/format";
import type { ScheduleKind, ScheduleValue } from "../../lib/schedule";

const LABELS: Record<ScheduleKind, { title: string; hint: string }> = {
  queue: { title: "Add to queue", hint: "Goes out at the next free slot" },
  custom: { title: "Pick a time", hint: "Choose the exact date and time" },
  now: { title: "Share now", hint: "Publishes right away" },
  draft: { title: "Save as draft", hint: "Keep it for later" },
  keep: { title: "Keep as it is", hint: "Only change the text" },
};

type Props = {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  kinds: ScheduleKind[];
  name: string;
};

export default function ScheduleFields({
  value,
  onChange,
  kinds,
  name,
}: Props) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <fieldset>
      <legend className="sr-only">When should it go out?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {kinds.map((kind) => (
          <label
            key={kind}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${
              value.kind === kind
                ? "border-forest-700 bg-sage-100"
                : "border-line bg-paper hover:bg-sage-50"
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={value.kind === kind}
              onChange={() => onChange({ ...value, kind })}
              className="mt-1 accent-[#17261d]"
            />
            <span>
              <span className="block text-sm font-medium">
                {LABELS[kind].title}
              </span>
              <span className="block text-xs font-medium text-muted">
                {LABELS[kind].hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      {value.kind === "custom" && (
        <div className="mt-3">
          <label className="block text-sm font-medium">
            Date and time
            <input
              type="datetime-local"
              required
              min={toLocalInput(new Date())}
              value={value.dueLocal}
              onChange={(e) => onChange({ ...value, dueLocal: e.target.value })}
              className="field max-w-xs"
            />
          </label>
          <p className="mt-1.5 text-xs font-medium text-muted">
            Uses your browser's time zone ({zone}).
          </p>
        </div>
      )}
    </fieldset>
  );
}

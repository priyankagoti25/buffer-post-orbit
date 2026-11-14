import type { RateSnapshot } from "../../types/buffer";

/** Buffer allows a small number of requests, shared by everyone using this app. This shows what is left. */
export default function RateLimitMeter({
  rateLimit,
}: {
  rateLimit: RateSnapshot | null;
}) {
  if (!rateLimit?.windows.length) {
    return (
      <p className="text-sm text-muted">
        No request data yet. It appears after the first Buffer call.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {rateLimit.windows.map((w) => {
        const pct = w.limit
          ? Math.max(0, Math.min(100, (w.remaining / w.limit) * 100))
          : 100;
        const low = pct < 20;
        return (
          <li key={w.window}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-ink">Per {w.window}</span>
              <span
                className={
                  low ? "font-semibold text-red-700" : "font-medium text-muted"
                }
              >
                {w.remaining}
                {w.limit ? ` of ${w.limit}` : ""} left
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sage-100">
              <div
                className={`h-full rounded-full ${low ? "bg-red-500" : "bg-forest-600"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-medium text-muted">
              Resets in about {Math.max(1, Math.round(w.resetsInSeconds / 60))}{" "}
              min
            </p>
          </li>
        );
      })}
    </ul>
  );
}

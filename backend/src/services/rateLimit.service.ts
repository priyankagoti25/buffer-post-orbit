export type RateWindow = {
  window: string;
  limit: number | null;
  remaining: number;
  resetsInSeconds: number;
};
export type RateSnapshot = { capturedAt: string; windows: RateWindow[] };

const WINDOW_NAMES: Record<number, string> = {
  900: "15 minutes",
  86400: "24 hours",
  2592000: "30 days",
};

// Buffer's limit belongs to your APP CLIENT (shared by all users), so one global value is right.
let latest: RateSnapshot | null = null;

/** Read Buffer's RateLimit and RateLimit-Policy headers and remember them. */
export function recordRateLimit(headers: Record<string, unknown> | undefined) {
  if (!headers) return;
  const rateLimit = String(headers["ratelimit"] ?? "");
  const policy = String(headers["ratelimit-policy"] ?? "");
  if (!rateLimit) return;

  const policies = new Map<string, { limit: number; seconds: number }>();
  for (const m of policy.matchAll(/"([^"]+)";\s*q=(\d+);\s*w=(\d+)/g)) {
    policies.set(m[1], { limit: Number(m[2]), seconds: Number(m[3]) });
  }

  const windows: RateWindow[] = [];
  for (const m of rateLimit.matchAll(/"([^"]+)";\s*r=(\d+);\s*t=(\d+)/g)) {
    const p = policies.get(m[1]);
    windows.push({
      window: p ? (WINDOW_NAMES[p.seconds] ?? `${p.seconds}s`) : m[1],
      limit: p?.limit ?? null,
      remaining: Number(m[2]),
      resetsInSeconds: Number(m[3]),
    });
  }
  if (windows.length)
    latest = { capturedAt: new Date().toISOString(), windows };
}

export const getRateLimit = () => latest;

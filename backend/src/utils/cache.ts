type Entry = { value: unknown; expiresAt: number };

/**
 * Tiny in-memory cache with a time limit.
 * It keeps Buffer requests low (your app shares one small rate limit across all users).
 * It lives in one server process. If you run several servers, move it to Redis.
 */
export class TtlCache {
  private store = new Map<string, Entry>();

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
  ) {}

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set(key: string, value: unknown) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  deleteByPrefix(prefix: string) {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export const apiCache = new TtlCache(60_000);

/** Call after any write so the next read shows fresh data. */
export const clearUserCache = (userId: string) =>
  apiCache.deleteByPrefix(`${userId}:`);

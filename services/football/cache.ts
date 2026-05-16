// In-memory TTL cache for football data
// TTL: 30s live, 5min upcoming, 24h finished
// Resets on cold start (acceptable for Vercel serverless)

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export const cache = new TTLCache();

export const TTL = {
  LIVE: 30_000,          // 30 seconds
  UPCOMING: 5 * 60_000,  // 5 minutes
  FINISHED: 24 * 60 * 60_000, // 24 hours
  STANDINGS: 60 * 60_000,    // 1 hour
} as const;

export function matchTTL(status: string): number {
  if (status === "live" || status === "halftime") return TTL.LIVE;
  if (status === "finished") return TTL.FINISHED;
  return TTL.UPCOMING;
}

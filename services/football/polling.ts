// Polling logic — determines what needs to be refreshed and when

import type { FootballMatch } from "./types";

export function shouldPollLive(match: FootballMatch): boolean {
  return match.status === "live" || match.status === "halftime";
}

export function shouldPollSoon(match: FootballMatch): boolean {
  if (match.status !== "upcoming") return false;
  const kickoff = new Date(match.starts_at).getTime();
  const now = Date.now();
  const twoHours = 2 * 60 * 60_000;
  return kickoff - now < twoHours && kickoff > now;
}

export function pollIntervalMs(match: FootballMatch): number {
  if (shouldPollLive(match)) return 30_000;    // 30s
  if (shouldPollSoon(match)) return 5 * 60_000; // 5min
  if (match.status === "finished") return 24 * 60 * 60_000; // 24h
  return 15 * 60_000; // 15min default
}

// Returns matches that need active polling right now
export function filterPollable(matches: FootballMatch[]): FootballMatch[] {
  return matches.filter((m) => shouldPollLive(m) || shouldPollSoon(m));
}

// Deduplicate concurrent requests for the same resource
const inflight = new Map<string, Promise<unknown>>();

export async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

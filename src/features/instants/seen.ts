
"use client";

/**
 * Local, per-device mute + seen tracking — deliberately no server table.
 * Anything a viewer hides only needs to stay hidden on their device until
 * they tell us otherwise; dealt Instants are remembered locally so the nav
 * badge can count what's new. Lifting either contract requires a schema
 * change — nothing else here would move.
 */

import { useSyncExternalStore } from "react";

const MUTE_KEY = "mono.muted";
const SEEN_KEY = "mono.seen";
const SEEN_CAP = 500;

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

// Cached snapshots — useSyncExternalStore requires stable references.
const snapshotCache = new Map<string, { json: string; value: Set<string> }>();
const EMPTY = new Set<string>();
const SERVER_EMPTY = () => EMPTY;

function snapshot(key: string): Set<string> {
  if (typeof window === "undefined") return EMPTY;
  const json = window.localStorage.getItem(key) ?? "[]";
  const cached = snapshotCache.get(key);
  if (cached?.json === json) return cached.value;
  let next: Set<string>;
  try {
    const parsed = JSON.parse(json);
    next = new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
    );
  } catch {
    next = new Set();
  }
  snapshotCache.set(key, { json, value: next });
  return next;
}

function persist(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* storage full or blocked — best-effort */
  }
  snapshotCache.delete(key);
  emit();
}

export function isAccountMuted(ownerId: string): boolean {
  return snapshot(MUTE_KEY).has(ownerId);
}

export function toggleMute(ownerId: string): boolean {
  const ids = new Set(snapshot(MUTE_KEY));
  if (ids.has(ownerId)) ids.delete(ownerId);
  else ids.add(ownerId);
  persist(MUTE_KEY, ids);
  return ids.has(ownerId);
}

export function isSeen(instantId: string): boolean {
  return snapshot(SEEN_KEY).has(instantId);
}

export function markSeen(instantId: string) {
  const ids = new Set(snapshot(SEEN_KEY));
  ids.add(instantId);
  persist(SEEN_KEY, new Set([...ids].slice(-SEEN_CAP)));
}

export function useMutedAccounts(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => snapshot(MUTE_KEY), SERVER_EMPTY);
}

export function useUnseenCount(items: { id: string }[]): number {
  const seen = useSyncExternalStore(subscribe, () => snapshot(SEEN_KEY), SERVER_EMPTY);
  let count = 0;
  for (const item of items) {
    if (!seen.has(item.id)) count += 1;
  }
  return count;
}

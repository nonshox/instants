"use client";

import { useSyncExternalStore } from "react";

export function LocalDateTime({ value }: { value: string }) {
  const dateText = useSyncExternalStore(
    subscribe,
    () => formatLocal(value),
    () => formatUtc(value),
  );

  return <time dateTime={value}>{dateText}</time>;
}

function subscribe(): () => void {
  return () => {};
}

function formatLocal(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function formatUtc(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

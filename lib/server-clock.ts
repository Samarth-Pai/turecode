"use client";

import { useEffect, useState } from "react";

let latestServerOffsetMs = 0;

/**
 * Records the offset between server time and the client PC's local clock.
 * Call this right when an API response containing `serverNow` is received.
 */
export function recordServerTime(serverNow?: number): number {
  if (typeof serverNow === "number" && Number.isFinite(serverNow)) {
    latestServerOffsetMs = serverNow - Date.now();
  }
  return latestServerOffsetMs;
}

/**
 * Returns a ticking timestamp synchronized to the server's clock (`Date.now() + offsetMs`),
 * so round schedules, countdowns, and proctoring work even if the client PC clock is wrong.
 */
export function useSyncedNow(
  offsetMs = latestServerOffsetMs,
  intervalMs = 1000
): number {
  const [clientNow, setClientNow] = useState(0);

  useEffect(() => {
    const immediate = setTimeout(() => setClientNow(Date.now()), 0);
    const id = setInterval(() => setClientNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, [intervalMs]);

  return clientNow > 0 ? clientNow + offsetMs : 0;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hms = `${String(hours).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

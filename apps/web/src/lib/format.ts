/**
 * Formats an ISO timestamp as a short local time.
 *
 * @param iso the timestamp
 * @returns e.g. "09:22 PM"
 */
export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats an ISO timestamp as a local date and time.
 *
 * @param iso the timestamp
 * @returns e.g. "25 Aug, 09:22 PM"
 */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * How long a call ran, in whole seconds.
 *
 * @param startedAt when it began
 * @param endedAt when it ended, or null while still ringing
 * @returns seconds elapsed, or 0 when unfinished
 */
export function durationSeconds(startedAt: string, endedAt: string | null): number {
  if (endedAt === null) return 0;
  return Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000));
}

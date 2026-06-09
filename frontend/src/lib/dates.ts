// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED WIRING — pure date helpers used for the calendar grid and ranges.
// ─────────────────────────────────────────────────────────────────────────────

// Zero-padded YYYY-MM-DD without timezone conversion.
export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
export function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

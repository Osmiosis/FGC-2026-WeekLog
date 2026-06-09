// PROTECTED WIRING — do not edit during design work. Owns the calendar's meeting-days.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ymd, daysInMonth } from "../dates";
import type { MeetingDayLite } from "./types";

export function useCalendar(year: number, month: number) {
  const [marked, setMarked] = useState<Map<string, MeetingDayLite>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const from = ymd(year, month, 1);
    const to = ymd(year, month, daysInMonth(year, month));
    try {
      const rows = await api<MeetingDayLite[]>(`/api/meeting-days?from=${from}&to=${to}`);
      setMarked(new Map(rows.map((r) => [r.date, r])));
    } catch (e) {
      setError(String(e));
    }
  }, [year, month]);
  useEffect(() => {
    reload();
  }, [reload]);

  const markDay = async (date: string, title?: string) => {
    await api("/api/meeting-days", { method: "POST", body: JSON.stringify({ date, title: title ?? null }) });
    await reload();
  };

  return { marked, error, reload, markDay };
}

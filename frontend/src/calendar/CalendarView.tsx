import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useCalendar } from "../lib/hooks/useCalendar";
import { ymd, daysInMonth, firstWeekday } from "../lib/dates";
import type { Rag } from "../lib/hooks/types";
import { MeetingDayDetail } from "./MeetingDayDetail";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RAG: Record<Rag, { bg: string; border: string; label: string }> = {
  green: { bg: "#e7f6e9", border: "#2f9e44", label: "complete" },
  amber: { bg: "#fff4e0", border: "#e8a317", label: "in progress" },
  red: { bg: "#fdeaea", border: "#d6336c", label: "missing" },
};

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  minHeight: 56,
  padding: 4,
  textAlign: "right",
  fontSize: 13,
};

export function CalendarView({ initialOpenDayId }: { initialOpenDayId?: string | null } = {}) {
  const { isAdmin } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [openDayId, setOpenDayId] = useState<string | null>(initialOpenDayId ?? null);
  const { marked, error, reload, markDay } = useCalendar(year, month);

  const prev = () => (month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1));
  const next = () => (month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1));

  const clickDay = async (date: string) => {
    const existing = marked.get(date);
    if (existing) {
      setOpenDayId(existing.id);
      return;
    }
    if (isAdmin) await markDay(date);
  };

  const total = daysInMonth(year, month);
  const lead = firstWeekday(year, month);
  const cells = useMemo(() => {
    const arr: Array<number | null> = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [lead, total]);

  if (openDayId) {
    return (
      <MeetingDayDetail
        dayId={openDayId}
        onBack={() => {
          setOpenDayId(null);
          reload();
        }}
      />
    );
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={prev}>Prev</button>
        <h2 style={{ margin: 0 }}>
          {MONTHS[month]} {year}
        </h2>
        <button onClick={next}>Next</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <p style={{ fontSize: 13, color: "#555" }}>
        {isAdmin
          ? "Tap an empty day to mark it as a meeting day. Tap a meeting day to open its checklist."
          : "Tap a meeting day to open its checklist."}
      </p>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 8 }}>
        {(["green", "amber", "red"] as Rag[]).map((r) => (
          <span key={r}>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                background: RAG[r].bg,
                outline: `2px solid ${RAG[r].border}`,
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            {RAG[r].label}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ ...cell, minHeight: 0, fontWeight: 600, textAlign: "center" }}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} style={{ ...cell, background: "#fafafa" }} />;
          const date = ymd(year, month, d);
          const meeting = marked.get(date);
          const rag = meeting ? RAG[meeting.status] : null;
          return (
            <div
              key={date}
              onClick={() => clickDay(date)}
              style={{
                ...cell,
                cursor: meeting || isAdmin ? "pointer" : "default",
                background: rag ? rag.bg : "white",
                outline: rag ? `2px solid ${rag.border}` : "none",
              }}
            >
              <div>{d}</div>
              {meeting && rag && (
                <div style={{ fontSize: 11, color: rag.border, textAlign: "left" }}>{rag.label}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { MeetingDayDetail } from "./MeetingDayDetail";

type Rag = "green" | "amber" | "red";

interface MeetingDay {
  id: string;
  date: string;
  title: string | null;
  status: Rag;
}

const RAG: Record<Rag, { bg: string; border: string; label: string }> = {
  green: { bg: "#e7f6e9", border: "#2f9e44", label: "complete" },
  amber: { bg: "#fff4e0", border: "#e8a317", label: "in progress" },
  red: { bg: "#fdeaea", border: "#d6336c", label: "missing" },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Zero-padded YYYY-MM-DD without timezone conversion.
function ymd(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

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
  const [marked, setMarked] = useState<Map<string, MeetingDay>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [openDayId, setOpenDayId] = useState<string | null>(initialOpenDayId ?? null);

  useEffect(() => {
    if (initialOpenDayId) setOpenDayId(initialOpenDayId);
  }, [initialOpenDayId]);

  const load = useCallback(async () => {
    setErr(null);
    const from = ymd(year, month, 1);
    const to = ymd(year, month, daysInMonth(year, month));
    try {
      const rows = await api<MeetingDay[]>(`/api/meeting-days?from=${from}&to=${to}`);
      setMarked(new Map(rows.map((r) => [r.date, r])));
    } catch (e) {
      setErr(String(e));
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const prev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(month + 1);
  };

  // Clicking a marked day opens its detail. Clicking an unmarked day marks it (admin only).
  const clickDay = async (date: string) => {
    const existing = marked.get(date);
    if (existing) {
      setOpenDayId(existing.id);
      return;
    }
    if (!isAdmin) return;
    try {
      await api("/api/meeting-days", { method: "POST", body: JSON.stringify({ date }) });
      await load();
    } catch (e) {
      setErr(String(e));
    }
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
          load();
        }}
        onUnmarked={() => {
          setOpenDayId(null);
          load();
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
      {err && <p style={{ color: "crimson" }}>{err}</p>}
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
                <div style={{ fontSize: 11, color: rag.border, textAlign: "left" }}>
                  {rag.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && <BulkMark onDone={load} />}
    </section>
  );
}

function BulkMark({ onDone }: { onDone: () => void }) {
  const [days, setDays] = useState<Set<number>>(new Set([2, 4]));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (n: number) => {
    const next = new Set(days);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setDays(next);
  };

  const submit = async () => {
    setMsg(null);
    if (!start || !end || days.size === 0) {
      setMsg("Pick a start date, an end date, and at least one weekday.");
      return;
    }
    try {
      const out = await api<{ created: number; skipped: number }>(
        "/api/meeting-days/bulk",
        { method: "POST", body: JSON.stringify({ start, end, weekdays: [...days] }) }
      );
      setMsg(`Created ${out.created} meeting days (skipped ${out.skipped} already marked).`);
      onDone();
    } catch (e) {
      setMsg(String(e));
    }
  };

  return (
    <div style={{ marginTop: 20, padding: 12, border: "1px solid #ddd" }}>
      <h3 style={{ marginTop: 0 }}>Bulk mark a recurring schedule</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {WEEKDAYS.map((w, n) => (
          <label key={w} style={{ fontSize: 13 }}>
            <input type="checkbox" checked={days.has(n)} onChange={() => toggle(n)} /> {w}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 13 }}>
          From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ fontSize: 13 }}>
          To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button onClick={submit}>Mark days</button>
      </div>
      {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

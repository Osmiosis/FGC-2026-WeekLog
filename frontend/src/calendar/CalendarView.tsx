import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useCalendar } from "../lib/hooks/useCalendar";
import { ymd, daysInMonth, firstWeekday } from "../lib/dates";
import { Icon } from "../ui/Icon";
import { ScreenHead, RAG_VAR, useWide } from "../ui/primitives";
import { MeetingDayDetail } from "./MeetingDayDetail";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ initialOpenDayId }: { initialOpenDayId?: string | null } = {}) {
  const { isAdmin } = useAuth();
  const wide = useWide();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [openDayId, setOpenDayId] = useState<string | null>(initialOpenDayId ?? null);
  const [bulk, setBulk] = useState(false);
  const { marked, error, reload, markDay } = useCalendar(year, month);

  const prev = () => (month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1));
  const next = () => (month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1));

  const total = daysInMonth(year, month);
  const lead = firstWeekday(year, month);
  const cells = useMemo(() => {
    const arr: Array<number | null> = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [lead, total]);

  const clickDay = async (date: string) => {
    const existing = marked.get(date);
    if (existing) { setOpenDayId(existing.id); return; }
    if (isAdmin) await markDay(date);
  };

  // Bulk recurring mark using the existing single markDay (no new hook needed).
  const applyBulk = async (weekdays: Record<number, boolean>) => {
    for (let d = 1; d <= total; d++) {
      const wd = new Date(year, month, d).getDay();
      const date = ymd(year, month, d);
      if (weekdays[wd] && !marked.get(date)) await markDay(date);
    }
    setBulk(false);
  };

  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  if (openDayId) {
    return <MeetingDayDetail dayId={openDayId} onBack={() => { setOpenDayId(null); reload(); }} />;
  }

  return (
    <div className="screen-in">
      <ScreenHead num="02" eyebrow="Calendar" title="Meeting days" wide={wide}
        sub={isAdmin ? "Tap an empty day to mark a meeting. Tap a meeting day to open its checklist." : "Tap a meeting day to open its checklist."} />

      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0 18px" }}>
        <button className="btn btn-sm" style={{ width: 40, padding: 0, justifyContent: "center" }} onClick={prev}><Icon name="chevron" size={16} style={{ transform: "rotate(180deg)" }} /></button>
        <h3 className="display" style={{ fontSize: 22, margin: 0, minWidth: 168 }}>{MONTHS[month]} {year}</h3>
        <button className="btn btn-sm" style={{ width: 40, padding: 0, justifyContent: "center" }} onClick={next}><Icon name="chevron" size={16} /></button>
        {isAdmin && <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => setBulk(true)}><Icon name="grid" size={15} /> Bulk mark</button>}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        {(["green", "amber", "red"] as const).map((s) => (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: RAG_VAR[s] }} />
            <span className="mono-label" style={{ fontSize: 10 }}>{s === "green" ? "complete" : s === "amber" ? "in progress" : "missing"}</span>
          </span>
        ))}
      </div>

      <div className="cal-grid">
        {DOW.map((w) => <div key={w} className="cal-dow">{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={"e" + i} className="cal-cell empty" />;
          const date = ymd(year, month, d);
          const mtg = marked.get(date);
          const cls = ["cal-cell", date === todayStr ? "today" : "", mtg ? "meeting " + mtg.status : ""].join(" ");
          return (
            <div key={date} className={cls} onClick={() => clickDay(date)} style={{ cursor: mtg || isAdmin ? "pointer" : "default" }}>
              <span className="dnum">{d}</span>
              {mtg && <span className="dot-status" style={{ background: RAG_VAR[mtg.status] }} />}
              {mtg && mtg.title && wide && <span className="mono-label" style={{ fontSize: 9, marginTop: "auto", lineHeight: 1.2, color: "var(--fg-dim)", paddingRight: 14 }}>{mtg.title}</span>}
            </div>
          );
        })}
      </div>

      {bulk && <BulkSheet month={month} onClose={() => setBulk(false)} onApply={applyBulk} />}
    </div>
  );
}

function BulkSheet({ month, onClose, onApply }: { month: number; onClose: () => void; onApply: (wd: Record<number, boolean>) => void }) {
  const [days, setDays] = useState<Record<number, boolean>>({ 2: true, 4: true });
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" style={{ maxWidth: 460, margin: "0 auto" }}>
        <div className="grab" />
        <p className="eyebrow"><span className="dot">/ </span>Bulk mark</p>
        <h3 className="display" style={{ fontSize: 22, margin: "6px 0 4px" }}>Recurring meetings</h3>
        <p style={{ color: "var(--fg-dim)", fontSize: 14, marginTop: 0 }}>Pick the weekdays your team meets. Every matching day in {MONTHS[month]} gets marked.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
          {DOW.map((w, i) => (
            <button key={w} className={"chip" + (days[i] ? " on" : "")} onClick={() => setDays((c) => ({ ...c, [i]: !c[i] }))}>{w}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => onApply(days)}><Icon name="check" size={16} /> Mark these days</button>
      </div>
    </>
  );
}

import { useDashboard } from "../lib/hooks/useDashboard";
import type { Rag } from "../lib/hooks/types";
import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { RagTag, RAG_ICON, RAG_VAR, fmtDate } from "../ui/primitives";

const STATUS_WORD: Record<Rag, string> = {
  green: "All on track",
  amber: "Attention soon",
  red: "Action needed",
};

function SectionHead({ num, eyebrow, title, action }: { num: string; eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="index-num" style={{ fontSize: 13 }}>{num}</span>
        <p className="eyebrow"><span className="dot">/ </span>{eyebrow}</p>
        {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
      </div>
      <h3 className="display" style={{ fontSize: 21, marginTop: 6, fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

export function Dashboard({
  wide = false,
  onOpenDay,
  onGoToDeadlines,
}: {
  wide?: boolean;
  onOpenDay: (id: string) => void;
  onGoToDeadlines: () => void;
}) {
  const { data: d, driveConfigured, error, downloadAllMedia, downloading, downloadError, downloadProgress } = useDashboard();

  if (error) return <p style={{ color: "var(--bad)", padding: 4 }}>{error}</p>;
  if (!d) return <p className="mono-label" style={{ padding: 4 }}>Loading...</p>;

  const heroColor = RAG_VAR[d.overall];

  const Hero = (
    <div className="hero-status">
      <div className="serration" />
      <div style={{ padding: wide ? "26px 28px" : "22px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <span className="index-num" style={{ fontSize: wide ? 64 : 52 }}>01</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow"><span className="dot">/ </span>Team status · {d.today}</p>
            <h2 className="display" style={{ fontSize: wide ? 40 : 32, marginTop: 8, color: heroColor }}>
              {STATUS_WORD[d.overall]}
            </h2>
            <p style={{ color: "var(--fg-dim)", fontSize: 14.5, marginTop: 8, maxWidth: 460 }}>
              {d.counts.daysFlagged} meeting {d.counts.daysFlagged === 1 ? "day" : "days"} flagged,
              {" "}{d.counts.deadlinesOverdue} {d.counts.deadlinesOverdue === 1 ? "deadline" : "deadlines"} overdue,
              {" "}{d.counts.deadlinesDueSoon} due soon.
              {d.overall === "green" ? " Everything is documented." : " Clear the red items to get back to green."}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <Stat label="Days flagged" value={d.counts.daysFlagged} tone="red" />
          <Stat label="Overdue" value={d.counts.deadlinesOverdue} tone="red" />
          <Stat label="Due soon" value={d.counts.deadlinesDueSoon} tone="amber" />
        </div>
      </div>
    </div>
  );

  const NeedsAttention = (
    <section>
      <SectionHead num="02" eyebrow="Needs attention" title="Fix these first"
        action={d.needsAttention.length > 0 ? <RagTag status="red">{d.needsAttention.length} open</RagTag> : <RagTag status="green">Clear</RagTag>} />
      {d.needsAttention.length === 0 ? (
        <div className="rag green" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="check" size={16} style={{ color: "var(--ok)" }} />
          <span style={{ fontWeight: 600 }}>Nothing flagged. Nice work.</span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {d.needsAttention.map((n) => (
            <button key={`${n.type}-${n.id}`} className="rag red"
              onClick={() => (n.type === "day" ? onOpenDay(n.id) : onGoToDeadlines())}
              style={{ textAlign: "left", cursor: "pointer", border: 0, width: "100%", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name={n.type === "deadline" ? "flag" : "calendar"} size={15} style={{ color: "var(--bad)" }} />
                <span className="mono-label" style={{ color: "var(--bad)" }}>
                  {n.date ? fmtDate(n.date, { weekday: "short", month: "short", day: "numeric" }) : n.due_date ? "Due " + fmtDate(n.due_date) : ""}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: "var(--fg)" }}>{n.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "var(--maroon-bright)", fontSize: 13, fontWeight: 600 }}>
                {n.type === "deadline" ? "Open deadline" : "Open meeting day"} <Icon name="arrow" size={14} />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const ThisWeek = (
    <section>
      <SectionHead num="03" eyebrow="This week" title="Meeting days" />
      {d.thisWeek.length === 0 ? (
        <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No meeting days this week.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(d.thisWeek.length, 7)}, 1fr)`, gap: 8 }}>
          {d.thisWeek.map((w) => (
            <button key={w.id} className={`week-cell ${w.status}`} onClick={() => onOpenDay(w.id)} style={{ cursor: "pointer", border: "1px solid var(--line)", borderRadius: "var(--r-sm)" }}>
              <span className="bar" />
              <div className="mono-label" style={{ fontSize: 10 }}>{fmtDate(w.date, { weekday: "short" })}</div>
              <div className="display" style={{ fontSize: 22, marginTop: 2 }}>{new Date(w.date + "T00:00").getDate()}</div>
              <div style={{ marginTop: 8, minHeight: 18 }}>
                <Icon name={RAG_ICON[w.status]} size={14} style={{ color: RAG_VAR[w.status] }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const Deadlines = (
    <section>
      <SectionHead num="04" eyebrow="Upcoming deadlines" title="On the horizon"
        action={<button className="btn btn-ghost btn-sm" onClick={onGoToDeadlines} style={{ minHeight: 0, padding: "4px 6px" }}>All <Icon name="chevron" size={14} /></button>} />
      {d.upcomingDeadlines.length === 0 ? (
        <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No open deadlines.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {d.upcomingDeadlines.map((u) => (
            <button key={u.id} className="card card-pad" onClick={onGoToDeadlines} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600 }}>{u.title}</div>
                <div className="mono-label" style={{ marginTop: 5 }}>Due {fmtDate(u.due_date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="display" style={{ fontSize: 26, color: RAG_VAR[u.status] }}>{Math.abs(u.daysUntil)}</div>
                <div className="mono-label" style={{ fontSize: 9 }}>{u.daysUntil < 0 ? "days late" : "days"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const Export = (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button className="btn" onClick={downloadAllMedia} disabled={downloading}>
        <Icon name="download" size={16} />{" "}
        {downloading
          ? downloadProgress
            ? `Zipping ${downloadProgress.done}/${downloadProgress.total}…`
            : "Preparing ZIP…"
          : "Download all media (ZIP)"}
      </button>
      <p className="mono-label" style={{ flex: 1, minWidth: 180, lineHeight: 1.5, color: downloadError ? "var(--bad)" : "var(--fg-faint)" }}>
        {downloadError ?? (driveConfigured ? "Drive sync is configured." : "Drive sync not configured. Export a ZIP and upload to the mentors' Drive.")}
      </p>
    </div>
  );

  if (wide) {
    return (
      <div style={{ display: "grid", gap: 28 }}>
        {Hero}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 28, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 28 }}>{NeedsAttention}{ThisWeek}</div>
          <div style={{ display: "grid", gap: 28 }}>{Deadlines}{Export}</div>
        </div>
      </div>
    );
  }
  return <div style={{ display: "grid", gap: 26 }}>{Hero}{NeedsAttention}{ThisWeek}{Deadlines}{Export}</div>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: Rag }) {
  return (
    <div className="card" style={{ padding: "10px 14px", flex: 1, minWidth: 96 }}>
      <div className="display" style={{ fontSize: 24, color: value > 0 ? RAG_VAR[tone] : "var(--fg-faint)" }}>{value}</div>
      <div className="mono-label" style={{ fontSize: 9, marginTop: 2 }}>{label}</div>
    </div>
  );
}

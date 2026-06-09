import { useState } from "react";
import { useBuildNeeds, useSearch, SUBSYSTEMS, SUBMISSION_KINDS } from "../lib/hooks/useBrowse";
import type { Submission } from "../lib/hooks/types";
import { Icon } from "../ui/Icon";
import { ScreenHead, fmtDate } from "../ui/primitives";

function dayIdOf(s: Submission): string {
  return (s.meeting_day_id ?? s.day_id) as string;
}

export function BrowseView({ onOpenDay, wide }: { onOpenDay: (id: string) => void; wide?: boolean }) {
  const [tab, setTab] = useState<"needs" | "search">("needs");
  return (
    <div className="screen-in">
      <ScreenHead num="02" eyebrow="Browse" title="Find anything" wide={wide}
        sub="Search every submission, or work the open build-needs list." />
      <div className="segmented" style={{ marginBottom: 20 }}>
        <button className={tab === "needs" ? "on" : ""} onClick={() => setTab("needs")}>Open build needs</button>
        <button className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>Search</button>
      </div>
      {tab === "needs" ? <BuildNeeds onOpenDay={onOpenDay} /> : <SearchView onOpenDay={onOpenDay} />}
    </div>
  );
}

function BuildNeeds({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  const [showResolved, setShowResolved] = useState(false);
  const { rows, setResolved } = useBuildNeeds(showResolved);
  const openCount = rows.filter((r) => !r.resolved).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span className="mono-label">{openCount} open</span>
        <button className="chip" style={{ textTransform: "none" }} onClick={() => setShowResolved(!showResolved)}>{showResolved ? "Hide" : "Show"} resolved</button>
      </div>
      {rows.length === 0 ? <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No open build needs.</p> : (
        <div className="stagger" style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ borderLeft: `4px solid ${r.resolved ? "var(--ok)" : "var(--warn)"}`, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, textDecoration: r.resolved ? "line-through" : "none", opacity: r.resolved ? 0.6 : 1 }}>{r.content}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  {r.subsystem && <span className="mono-label" style={{ fontSize: 10, color: "var(--maroon-bright)" }}>{r.subsystem}</span>}
                  {r.date && <span className="mono-label" style={{ fontSize: 10 }}>· {fmtDate(r.date)}</span>}
                  <button className="mono-label" onClick={() => onOpenDay(dayIdOf(r))} style={{ fontSize: 10, color: "var(--fg-dim)", background: "none", border: 0, cursor: "pointer", padding: 0 }}>· open day</button>
                </div>
              </div>
              <button className={"check" + (r.resolved ? " on" : "")} onClick={() => setResolved(r.id, !r.resolved)}><Icon name="check" size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchView({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  const { results, ran, run } = useSearch();
  const [q, setQ] = useState("");
  const [subsystem, setSubsystem] = useState("");
  const [kind, setKind] = useState("");

  const doSearch = () => run({ q, subsystem, kind });

  return (
    <div>
      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }}><Icon name="search" size={17} /></span>
          <input className="input" style={{ paddingLeft: 40 }} placeholder="Search accomplishments, build needs, goals..." value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={"chip" + (subsystem === "" ? " on" : "")} onClick={() => setSubsystem("")}>All</button>
          {SUBSYSTEMS.map((s) => <button key={s} className={"chip" + (subsystem === s ? " on" : "")} onClick={() => setSubsystem(s)}>{s}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="select" style={{ width: "auto", flex: "0 1 200px" }} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Any kind</option>
            {SUBMISSION_KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={doSearch}><Icon name="search" size={15} /> Search</button>
        </div>
      </div>

      {ran && results.length === 0 && <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No matches.</p>}
      <div className="stagger" style={{ display: "grid", gap: 8 }}>
        {results.map((s) => (
          <button key={s.id} className="card" style={{ padding: 14, textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => onOpenDay(dayIdOf(s))}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
              <span className="mono-label" style={{ fontSize: 10, color: "var(--maroon-bright)" }}>{s.kind.replace("_", " ")}</span>
              {s.subsystem && <span className="mono-label" style={{ fontSize: 10 }}>· {s.subsystem}</span>}
              {s.date && <span className="mono-label" style={{ fontSize: 10, marginLeft: "auto", color: "var(--fg-faint)" }}>{fmtDate(s.date)}</span>}
            </div>
            <div style={{ fontSize: 14.5 }}>{s.content}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

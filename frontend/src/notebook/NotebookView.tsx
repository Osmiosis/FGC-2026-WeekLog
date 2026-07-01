import { useState } from "react";
import { useNotebook } from "../lib/hooks/useNotebook";
import { useAuth } from "../auth/AuthProvider";
import { TimelineTab } from "./TimelineTab";
import { fmtDate } from "../ui/primitives";

type NbTab = "timeline" | "gaps" | "decisions" | "scaffold";
const TABS: { id: NbTab; label: string; ready: boolean }[] = [
  { id: "timeline", label: "Timeline", ready: true },
  { id: "gaps", label: "Gaps", ready: false },
  { id: "decisions", label: "Decisions", ready: false },
  { id: "scaffold", label: "Scaffold", ready: false },
];

export function NotebookView() {
  const { isAdmin } = useAuth();
  const { timeline, reports, pending, busy, generateTimeline, requestRefresh } = useNotebook();
  const [tab, setTab] = useState<NbTab>("timeline");
  const timelinePending = pending.find((p) => p.kind === "timeline")?.count ?? 0;
  const generatedAt = reports?.timeline?.generated_at ?? null;

  return (
    <div>
      <div className="card card-pad" style={{ borderLeft: "3px solid var(--maroon-bright)", marginBottom: 18 }}>
        <p className="mono-label" style={{ lineHeight: 1.6 }}>
          Draft raw material and audit for the team's engineering notebook. Not a notebook. The team writes the notebook.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className="btn btn-ghost btn-sm"
            disabled={!t.ready}
            onClick={() => t.ready && setTab(t.id)}
            style={{ borderBottom: tab === t.id ? "2px solid var(--maroon-bright)" : "2px solid transparent", opacity: t.ready ? 1 : 0.4 }}
          >
            {t.label}
            {!t.ready && <span aria-hidden="true"> (soon)</span>}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {isAdmin ? (
          <button className="btn btn-sm" disabled={busy} onClick={generateTimeline}>
            {busy ? "Generating..." : "Generate / refresh timelines"}
          </button>
        ) : (
          <button className="btn btn-sm" onClick={() => requestRefresh("timeline")}>Request refresh</button>
        )}
        {isAdmin && timelinePending > 0 && (
          <span className="mono-label" style={{ color: "var(--warn)" }}>{timelinePending} refresh requested</span>
        )}
        <span className="mono-label" style={{ color: "var(--fg-faint)" }}>
          {generatedAt ? `Last updated ${fmtDate(generatedAt)}` : "Not generated yet"}
        </span>
      </div>

      {tab === "timeline" &&
        (timeline ? (
          <TimelineTab payload={timeline} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>
            No timeline yet. {isAdmin ? "Click Generate to build it." : "Ask an admin to generate it."}
          </p>
        ))}
    </div>
  );
}

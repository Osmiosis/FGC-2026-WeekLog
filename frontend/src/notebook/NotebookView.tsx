import { useState } from "react";
import { useNotebook } from "../lib/hooks/useNotebook";
import { useAuth } from "../auth/AuthProvider";
import { TimelineTab } from "./TimelineTab";
import { GapsTab } from "./GapsTab";
import { DecisionsTab } from "./DecisionsTab";
import { ScaffoldTab } from "./ScaffoldTab";
import { fmtDate } from "../ui/primitives";
import type { GapPayload, DecisionPayload, ScaffoldPayload } from "@weeklog/types";

type NbTab = "timeline" | "gaps" | "decisions" | "scaffold";
// deterministic tabs get an in-app Generate button; reasoning tabs refresh via
// the NOTEBOOK_PREP.md pipeline, so they only expose request/pending.
const TABS: { id: NbTab; label: string; ready: boolean; deterministic: boolean }[] = [
  { id: "timeline", label: "Timeline", ready: true, deterministic: true },
  { id: "gaps", label: "Gaps", ready: true, deterministic: false },
  { id: "decisions", label: "Decisions", ready: true, deterministic: false },
  { id: "scaffold", label: "Scaffold", ready: true, deterministic: false },
];

export function NotebookView() {
  const { isAdmin } = useAuth();
  const { timeline, reports, pending, error, busy, generateTimeline, requestRefresh } = useNotebook();
  const [tab, setTab] = useState<NbTab>("timeline");

  const cfg = TABS.find((t) => t.id === tab)!;
  const pendingCount = pending.find((p) => p.kind === tab)?.count ?? 0;
  const generatedAt = reports?.[tab]?.generated_at ?? null;
  const gapsPayload = (reports?.gaps?.payload ?? null) as GapPayload | null;
  const decisionsPayload = (reports?.decisions?.payload ?? null) as DecisionPayload | null;
  const scaffoldPayload = (reports?.scaffold?.payload ?? null) as ScaffoldPayload | null;

  return (
    <div>
      <div className="card card-pad" style={{ borderLeft: "3px solid var(--maroon-bright)", marginBottom: 18 }}>
        <p className="mono-label" style={{ lineHeight: 1.6 }}>
          Draft raw material and audit for the team's engineering notebook. Not a notebook.
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
        {isAdmin && cfg.deterministic ? (
          <button className="btn btn-sm" disabled={busy} onClick={generateTimeline}>
            {busy ? "Generating..." : "Generate / refresh timelines"}
          </button>
        ) : !isAdmin ? (
          <button className="btn btn-sm" onClick={() => requestRefresh(tab)}>Request refresh</button>
        ) : null}
        {isAdmin && pendingCount > 0 && (
          <span className="mono-label" style={{ color: "var(--warn)" }}>{pendingCount} refresh requested</span>
        )}
        {isAdmin && !cfg.deterministic && (
          <span className="mono-label" style={{ color: "var(--fg-faint)" }}>Refresh by running NOTEBOOK_PREP.md in Claude Code.</span>
        )}
        <span className="mono-label" style={{ color: "var(--fg-faint)" }}>
          {generatedAt ? `Last updated ${fmtDate(generatedAt)}` : "Not generated yet"}
        </span>
        {error && <p className="mono-label" style={{ color: "var(--bad)" }}>{error}</p>}
      </div>

      {tab === "timeline" &&
        (timeline ? (
          <TimelineTab payload={timeline} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>
            No timeline yet. {isAdmin ? "Click Generate to build it." : "Ask an admin to generate it."}
          </p>
        ))}

      {tab === "gaps" &&
        (gapsPayload ? (
          <GapsTab payload={gapsPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No gap analysis yet.</p>
        ))}

      {tab === "decisions" &&
        (decisionsPayload ? (
          <DecisionsTab payload={decisionsPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No decision worksheet yet.</p>
        ))}

      {tab === "scaffold" &&
        (scaffoldPayload ? (
          <ScaffoldTab payload={scaffoldPayload} />
        ) : (
          <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No scaffold yet.</p>
        ))}
    </div>
  );
}

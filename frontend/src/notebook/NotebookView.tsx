// DEMO BRANCH: the Notebook Prep view is a static, backend-free showcase. The four
// tabs start LOCKED and a simulated Generate reveals seeded reports captured from
// the live site. Nothing here computes or calls any AI; there is no Worker.
import { useState } from "react";
import { TimelineTab } from "./TimelineTab";
import { GapsTab } from "./GapsTab";
import { DecisionsTab } from "./DecisionsTab";
import { ScaffoldTab } from "./ScaffoldTab";
import { timelineSeed, gapsSeed, decisionsSeed, scaffoldSeed } from "../lib/demo/notebookSeed";
import { loadReveal, saveReveal, type Reveal } from "../lib/demo/notebookReveal";

type NbTab = "timeline" | "gaps" | "decisions" | "scaffold";
const TABS: { id: NbTab; label: string; group: "timeline" | "reasoning" }[] = [
  { id: "timeline", label: "Timeline", group: "timeline" },
  { id: "gaps", label: "Gaps", group: "reasoning" },
  { id: "decisions", label: "Decisions", group: "reasoning" },
  { id: "scaffold", label: "Scaffold", group: "reasoning" },
];

export function NotebookView() {
  const [reveal, setReveal] = useState<Reveal>(loadReveal());
  const [tab, setTab] = useState<NbTab>("timeline");
  const [generating, setGenerating] = useState<null | "timeline" | "reasoning">(null);

  const unlocked = (t: NbTab) => (t === "timeline" ? reveal.timeline : reveal.reasoning);

  const generate = (group: "timeline" | "reasoning") => {
    if (generating) return;
    setGenerating(group);
    // Theatre only: a brief delay so the click feels like an action. This is NOT a
    // real AI call and computes nothing; it just reveals pre-captured sample data.
    setTimeout(() => {
      const next: Reveal = { ...reveal, [group]: true };
      setReveal(next);
      saveReveal(next);
      setGenerating(null);
      if (group === "reasoning") setTab("gaps");
    }, 1500);
  };

  return (
    <div>
      <div className="card card-pad" style={{ borderLeft: "3px solid var(--maroon-bright)", marginBottom: 12 }}>
        <p className="mono-label" style={{ lineHeight: 1.6 }}>
          Draft raw material and audit for the team's engineering notebook. Not a notebook.
        </p>
      </div>

      <p className="mono-label" style={{ color: "var(--fg-faint)", lineHeight: 1.6, marginBottom: 16 }}>
        Sample reports. In the real app, WeekLog generates these from a team's logged meetings; the
        reasoning reports are authored offline and published in, at zero runtime AI cost. Generate here
        is a preview, not a live AI call.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {!reveal.timeline && (
          <button className="btn btn-sm" disabled={!!generating} onClick={() => generate("timeline")}>
            {generating === "timeline" ? "Simulating..." : "Generate Timeline"}
          </button>
        )}
        {!reveal.reasoning && (
          <button className="btn btn-sm" disabled={!!generating} onClick={() => generate("reasoning")}>
            {generating === "reasoning" ? "Simulating..." : "Generate reasoning reports"}
          </button>
        )}
        {generating && (
          <span className="mono-label" style={{ color: "var(--warn)" }}>
            Simulating generation. This is sample data, not a real AI call.
          </span>
        )}
        {reveal.timeline && reveal.reasoning && !generating && (
          <span className="mono-label" style={{ color: "var(--fg-faint)" }}>All reports generated (sample data).</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", marginBottom: 18 }}>
        {TABS.map((t) => {
          const locked = !unlocked(t.id);
          return (
            <button
              key={t.id}
              className="btn btn-ghost btn-sm"
              onClick={() => setTab(t.id)}
              style={{ borderBottom: tab === t.id ? "2px solid var(--maroon-bright)" : "2px solid transparent", opacity: locked ? 0.45 : 1 }}
            >
              {t.label}
              {locked && <span aria-hidden="true"> (locked)</span>}
            </button>
          );
        })}
      </div>

      {!unlocked(tab) ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--fg-faint)" }}>
          <p className="mono-label">
            Locked. Use "{tab === "timeline" ? "Generate Timeline" : "Generate reasoning reports"}" above to preview this report (sample data).
          </p>
        </div>
      ) : tab === "timeline" ? (
        <TimelineTab payload={timelineSeed} />
      ) : tab === "gaps" ? (
        <GapsTab payload={gapsSeed} />
      ) : tab === "decisions" ? (
        <DecisionsTab payload={decisionsSeed} />
      ) : (
        <ScaffoldTab payload={scaffoldSeed} />
      )}
    </div>
  );
}

import { useState } from "react";
import type { TimelinePayload, TimelineEntryKind } from "@weeklog/types";
import { fmtDate } from "../ui/primitives";

// RAG-legible palette by entry kind. Green good, red attention, neutral otherwise.
const KIND_COLOR: Record<TimelineEntryKind, string> = {
  accomplishment: "var(--ok)",
  failure: "var(--bad)",
  build_need: "var(--warn)",
  performance_goal: "var(--maroon-bright)",
  note: "var(--fg-faint)",
};
const KIND_LABEL: Record<TimelineEntryKind, string> = {
  accomplishment: "Accomplishment",
  failure: "Failure",
  build_need: "Build need",
  performance_goal: "Performance goal",
  note: "Note",
};

export function TimelineTab({ payload }: { payload: TimelinePayload }) {
  const subsystems = payload.subsystems;
  const [active, setActive] = useState(subsystems[0]?.name ?? "");
  if (subsystems.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No logged submissions yet.</p>;
  }
  const current = subsystems.find((s) => s.name === active) ?? subsystems[0];
  const photosFor = (date: string) => payload.photosByDate.find((p) => p.date === date)?.photos ?? [];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {subsystems.map((s) => (
          <button
            key={s.name}
            className="btn btn-sm"
            onClick={() => setActive(s.name)}
            style={{ background: s.name === current.name ? "var(--maroon-tint)" : undefined }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {current.entries.map((e, i) => {
          const photos = photosFor(e.date);
          return (
            <div key={i} className="card card-pad">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 50, background: KIND_COLOR[e.kind], flex: "none" }} />
                <span className="mono-label">{KIND_LABEL[e.kind]}</span>
                <span className="mono-label" style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{fmtDate(e.date)}</span>
              </div>
              <div style={{ fontSize: 15 }}>{e.text}</div>
              {e.created_by && <div className="mono-label" style={{ marginTop: 6, color: "var(--fg-faint)" }}>{e.created_by}</div>}
              {photos.length > 0 && (
                <div className="mono-label" style={{ marginTop: 8, color: "var(--fg-dim)" }}>
                  Photos this meeting: {photos.map((p) => p.caption || p.kind).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

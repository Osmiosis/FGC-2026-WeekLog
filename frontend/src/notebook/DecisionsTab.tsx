import type { DecisionPayload, DecisionMissing } from "@weeklog/types";

const MISSING_LABEL: Record<DecisionMissing, string> = {
  why: "Why",
  numbers: "Numbers",
  alternatives: "Alternatives",
  result: "Result",
};

// A checklist of decision points. Each card shows what was chosen and amber
// "Needs" chips for what a human must still add. Guard against a malformed
// published payload so a bad report cannot blank the tab.
export function DecisionsTab({ payload }: { payload: DecisionPayload }) {
  if (!Array.isArray(payload.decisions) || payload.decisions.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No decision worksheet yet.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {payload.decisions.map((d, i) => (
        <div key={i} className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{d.title}</span>
            {d.subsystem && <span className="mono-label" style={{ color: "var(--fg-faint)" }}>{d.subsystem}</span>}
            {d.date && <span className="mono-label" style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>{d.date}</span>}
          </div>
          <div style={{ fontSize: 14.5, marginBottom: d.missing.length ? 8 : 0 }}>{d.chosen}</div>
          {d.missing.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {d.missing.map((m) => (
                <span
                  key={m}
                  className="mono-label"
                  style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid var(--warn)", color: "var(--warn)" }}
                >
                  Needs: {MISSING_LABEL[m]}
                </span>
              ))}
            </div>
          )}
          <div className="mono-label" style={{ color: "var(--fg-dim)" }}>{d.prompt}</div>
        </div>
      ))}
    </div>
  );
}

import type { GapPayload, GapStatus } from "@weeklog/types";

// RAG legible: strong good, thin needs work, missing absent.
const STATUS_COLOR: Record<GapStatus, string> = {
  strong: "var(--ok)",
  thin: "var(--warn)",
  missing: "var(--bad)",
};
const STATUS_LABEL: Record<GapStatus, string> = {
  strong: "Strong",
  thin: "Thin",
  missing: "Missing",
};

export function GapsTab({ payload }: { payload: GapPayload }) {
  if (!Array.isArray(payload.criteria) || payload.criteria.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No criteria in this report.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {payload.criteria.map((c, i) => (
        <div key={i} className="card card-pad" style={{ borderLeft: `3px solid ${STATUS_COLOR[c.status]}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 50, background: STATUS_COLOR[c.status], flex: "none" }} />
            <span style={{ fontWeight: 600 }}>{c.criterion}</span>
            <span className="mono-label" style={{ marginLeft: "auto", color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
          </div>
          <div style={{ fontSize: 14.5, marginBottom: c.suggestions.length ? 8 : 0 }}>{c.finding}</div>
          {c.suggestions.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {c.suggestions.map((s, j) => (
                <li key={j} className="mono-label" style={{ color: "var(--fg-dim)" }}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

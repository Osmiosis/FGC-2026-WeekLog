import type { ScaffoldPayload } from "@weeklog/types";

const DEFAULT_NOTICE = "DRAFT. NOT FOR SUBMISSION.";

// Assemble the scaffold into raw markdown for transfer into the real notebook doc.
function toMarkdown(payload: ScaffoldPayload): string {
  const lines: string[] = [payload.draft_notice || DEFAULT_NOTICE, ""];
  for (const s of payload.sections) {
    lines.push(`## ${s.heading}`);
    for (const r of s.raw_material) lines.push(`- ${r}`);
    for (const n of s.needs) lines.push(`[NEEDS: ${n}]`);
    lines.push("");
  }
  return lines.join("\n");
}

// DRAFT worksheet: verbatim raw material under each heading, with amber NEEDS
// slots a human must fill. Guarded so a malformed published payload cannot throw.
export function ScaffoldTab({ payload }: { payload: ScaffoldPayload }) {
  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    return <p className="mono-label" style={{ color: "var(--fg-faint)" }}>No scaffold yet.</p>;
  }
  const notice = payload.draft_notice || DEFAULT_NOTICE;
  const copy = () => {
    void navigator.clipboard.writeText(toMarkdown(payload));
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <span
          className="mono-label"
          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--bad)", color: "var(--bad)", fontWeight: 600 }}
        >
          {notice}
        </span>
        <button className="btn btn-sm" onClick={copy} style={{ marginLeft: "auto" }}>Copy raw markdown</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {payload.sections.map((s, i) => (
          <div key={i} className="card card-pad">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{s.heading}</div>
            {s.raw_material.length > 0 && (
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, display: "grid", gap: 4 }}>
                {s.raw_material.map((r, j) => (
                  <li key={j} style={{ fontSize: 14 }}>{r}</li>
                ))}
              </ul>
            )}
            {s.needs.length > 0 && (
              <div style={{ display: "grid", gap: 4 }}>
                {s.needs.map((n, j) => (
                  <div key={j} className="mono-label" style={{ color: "var(--warn)" }}>NEEDS: {n}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

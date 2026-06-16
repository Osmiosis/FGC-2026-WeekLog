// frontend/src/ui/DemoBadge.tsx
// Fixed "DEMO" pill with a reset action. Clearing the store and reloading
// restores the seeded sample data.
import { reset } from "../lib/demo/store";

export function DemoBadge() {
  const onReset = () => {
    if (!confirm("Reset the demo to its original sample data? Your changes in this browser will be cleared.")) return;
    reset();
    location.reload();
  };
  return (
    <div style={{ position: "fixed", bottom: 14, right: 14, zIndex: 50, display: "flex", alignItems: "center", gap: 8,
      background: "var(--ink-1)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 10px 6px 12px", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
      <span className="mono-label" style={{ fontSize: 10, letterSpacing: ".08em", color: "var(--maroon-bright)" }}>● DEMO</span>
      <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px" }} onClick={onReset} title="Restore sample data">Reset</button>
    </div>
  );
}

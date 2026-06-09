import { useState } from "react";
import { useTemplates, EXPECTED_KINDS } from "../lib/hooks/useTemplates";
import type { Template } from "../lib/hooks/types";
import { Icon } from "../ui/Icon";
import { RagTag, ScreenHead, useWide } from "../ui/primitives";

export function TemplatesAdmin() {
  const wide = useWide();
  const { templates, error, add, patch, reorder } = useTemplates();
  const [adding, setAdding] = useState(false);

  // Move an item up/down, then persist the new order via reorder(ids).
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= templates.length) return;
    const next = [...templates];
    [next[i], next[j]] = [next[j], next[i]];
    reorder(next);
  };

  return (
    <div className="screen-in">
      <ScreenHead num="02" eyebrow="Admin · Checklist" title="Requirements" wide={wide}
        sub="What every meeting day asks for. Edits never rewrite already-marked days, history stays snapshotted." />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

      <button className="btn btn-primary" style={{ marginBottom: 18 }} onClick={() => setAdding(true)}><Icon name="list" size={16} /> Add requirement</button>

      <div className="stagger" style={{ display: "grid", gap: 10 }}>
        {templates.map((t, i) => (
          <div key={t.id} className="card" style={{ padding: 16, opacity: t.active ? 1 : 0.5, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
              <button className="btn btn-ghost" style={{ minHeight: 0, padding: 2, width: 26 }} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="chevron" size={14} style={{ transform: "rotate(-90deg)" }} /></button>
              <button className="btn btn-ghost" style={{ minHeight: 0, padding: 2, width: 26 }} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="chevron" size={14} style={{ transform: "rotate(90deg)" }} /></button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>{t.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                <span className="tag neutral" style={{ fontSize: 9 }}>{t.expected_kind}</span>
                {t.compulsory ? <RagTag status="red">Compulsory</RagTag> : <span className="tag neutral" style={{ fontSize: 9 }}>Optional</span>}
              </div>
              {t.description && <div style={{ fontSize: 13.5, color: "var(--fg-dim)", marginTop: 8 }}>{t.description}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <button className={"toggle" + (t.compulsory ? " on" : "")} onClick={() => patch(t.id, { compulsory: t.compulsory ? 0 : 1 })}><i /></button>
                  <span className="mono-label" style={{ fontSize: 10 }}>Compulsory</span>
                </label>
                <button className="btn btn-sm btn-ghost" style={{ color: "var(--fg-faint)" }} onClick={() => patch(t.id, { active: t.active ? 0 : 1 })}>{t.active ? "Deactivate" : "Reactivate"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {adding && <AddTemplate onClose={() => setAdding(false)}
        onAdd={async (label, kind, compulsory) => { await add(label, kind, compulsory); setAdding(false); }} />}
    </div>
  );
}

function AddTemplate({ onClose, onAdd }: { onClose: () => void; onAdd: (label: string, kind: string, compulsory: boolean) => void }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState(EXPECTED_KINDS[1]); // text
  const [compulsory, setCompulsory] = useState(true);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={{ width: "min(460px, 92%)" }}>
        <p className="eyebrow"><span className="dot">/ </span>Checklist</p>
        <h3 className="display" style={{ fontSize: 23, margin: "6px 0 18px" }}>Add requirement</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="field"><label>Label</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Match strategy notes" /></div>
          <div className="field"><label>Expected kind</label>
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {EXPECTED_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <button className={"toggle" + (compulsory ? " on" : "")} onClick={() => setCompulsory(!compulsory)} type="button"><i /></button>
            <span className="mono-label" style={{ fontSize: 11 }}>Compulsory (counts toward red / amber / green)</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!label} onClick={() => onAdd(label, kind, compulsory)}>Add</button>
        </div>
      </div>
    </>
  );
}

import { useState } from "react";
import { useMembers, COMMITTEES } from "../lib/hooks/useMembers";
import type { Member } from "../lib/hooks/types";
import { Icon } from "../ui/Icon";
import { RagTag, ScreenHead, useWide } from "../ui/primitives";

export function MembersAdmin() {
  const wide = useWide();
  const { members, error, addMember, setActive } = useMembers();
  const [adding, setAdding] = useState(false);
  const active = members.filter((m) => m.active);

  const initials = (name: string) => name.split(" ").map((x) => x[0]).join("").slice(0, 2);

  return (
    <div className="screen-in">
      <ScreenHead num="02" eyebrow="Admin · Roster" title="Members" wide={wide}
        sub={`${active.length} active across ${COMMITTEES.length} committees.`} />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

      <button className="btn btn-primary" style={{ marginBottom: 18 }} onClick={() => setAdding(true)}><Icon name="users" size={16} /> Add member</button>

      {wide ? (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>Committee</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td><span className="mono-label" style={{ fontSize: 11 }}>{m.committee}</span></td>
                  <td>{m.active ? <RagTag status="green">Active</RagTag> : <span className="tag neutral">Inactive</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setActive(m.id, m.active ? 0 : 1)}>{m.active ? "Deactivate" : "Reactivate"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stagger" style={{ display: "grid", gap: 10 }}>
          {members.map((m) => (
            <div key={m.id} className="data-row" style={{ display: "flex", alignItems: "center", gap: 12, opacity: m.active ? 1 : 0.5 }}>
              <div style={{ width: 38, height: 38, borderRadius: 50, background: "var(--maroon-tint)", color: "var(--maroon-bright)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--disp)", fontWeight: 700, fontSize: 14, flex: "none" }}>{initials(m.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                <div className="mono-label" style={{ fontSize: 10 }}>{m.committee}</div>
              </div>
              <button className={"toggle" + (m.active ? " on" : "")} onClick={() => setActive(m.id, m.active ? 0 : 1)}><i /></button>
            </div>
          ))}
        </div>
      )}

      {adding && <AddMember onClose={() => setAdding(false)} onAdd={async (name, committee) => { await addMember(name, committee); setAdding(false); }} />}
    </div>
  );
}

function AddMember({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, committee: string) => void }) {
  const [name, setName] = useState("");
  const [committee, setCommittee] = useState(COMMITTEES[0]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={{ width: "min(440px, 92%)" }}>
        <p className="eyebrow"><span className="dot">/ </span>Roster</p>
        <h3 className="display" style={{ fontSize: 23, margin: "6px 0 18px" }}>Add member</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
          <div className="field"><label>Committee</label>
            <select className="select" value={committee} onChange={(e) => setCommittee(e.target.value)}>
              {COMMITTEES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name} onClick={() => onAdd(name, committee)}>Add</button>
        </div>
      </div>
    </>
  );
}

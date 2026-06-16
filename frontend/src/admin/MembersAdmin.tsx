import { useState } from "react";
import { useMembers } from "../lib/hooks/useMembers";
import type { Member, Committee } from "../lib/hooks/types";
import { Icon } from "../ui/Icon";
import { RagTag, ScreenHead, useWide } from "../ui/primitives";

// readOnly: members see the roster + committees, but no add/edit/deactivate controls.
export function MembersAdmin({ readOnly = false }: { readOnly?: boolean } = {}) {
  const wide = useWide();
  const { members, committees, error, addMember, updateMember, setActive } = useMembers();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const active = members.filter((m) => m.active);
  // Members only see the active roster; admins also see deactivated rows.
  const rows = readOnly ? active : members;

  const initials = (name: string) => name.split(" ").map((x) => x[0]).join("").slice(0, 2);
  // A member carries committee names; the form works in ids.
  const idsFor = (m: Member) => committees.filter((c) => m.committees.includes(c.name)).map((c) => c.id);

  return (
    <div className="screen-in">
      <ScreenHead num="02" eyebrow={readOnly ? "Roster" : "Admin · Roster"} title="Members" wide={wide}
        sub={`${active.length} active across ${committees.length} committees.`} />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

      {!readOnly && <button className="btn btn-primary" style={{ marginBottom: 18 }} onClick={() => setAdding(true)}><Icon name="users" size={16} /> Add member</button>}

      {wide ? (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>Committees</th><th>Status</th>{!readOnly && <th style={{ textAlign: "right" }}>Actions</th>}</tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td><span className="mono-label" style={{ fontSize: 11 }}>{m.committees.join(", ") || "—"}</span></td>
                  <td>{m.active ? <RagTag status="green">Active</RagTag> : <span className="tag neutral">Inactive</span>}</td>
                  {!readOnly && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(m)}>Edit</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setActive(m.id, m.active ? 0 : 1)}>{m.active ? "Deactivate" : "Reactivate"}</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stagger" style={{ display: "grid", gap: 10 }}>
          {rows.map((m) => (
            <div key={m.id} className="data-row" style={{ display: "flex", alignItems: "center", gap: 12, opacity: m.active ? 1 : 0.5 }}>
              <div style={{ width: 38, height: 38, borderRadius: 50, background: "var(--maroon-tint)", color: "var(--maroon-bright)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--disp)", fontWeight: 700, fontSize: 14, flex: "none" }}>{initials(m.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }} onClick={readOnly ? undefined : () => setEditing(m)}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                <div className="mono-label" style={{ fontSize: 10 }}>{m.committees.join(", ") || "—"}</div>
              </div>
              {!readOnly && <button className="btn btn-sm btn-ghost" onClick={() => setEditing(m)}>Edit</button>}
              {!readOnly && <button className={"toggle" + (m.active ? " on" : "")} onClick={() => setActive(m.id, m.active ? 0 : 1)}><i /></button>}
            </div>
          ))}
        </div>
      )}

      {!readOnly && adding && (
        <MemberForm title="Add member" committees={committees} onClose={() => setAdding(false)}
          onSave={async (name, ids) => { await addMember(name, ids); setAdding(false); }} />
      )}
      {!readOnly && editing && (
        <MemberForm title="Edit member" committees={committees} initialName={editing.name} initialIds={idsFor(editing)}
          onClose={() => setEditing(null)}
          onSave={async (name, ids) => { await updateMember(editing.id, { name, committeeIds: ids }); setEditing(null); }} />
      )}
    </div>
  );
}

function MemberForm({
  title, committees, initialName = "", initialIds = [], onClose, onSave,
}: {
  title: string;
  committees: Committee[];
  initialName?: string;
  initialIds?: string[];
  onClose: () => void;
  onSave: (name: string, committeeIds: string[]) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await onSave(name.trim(), selected); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={{ width: "min(460px, 92%)" }}>
        <p className="eyebrow"><span className="dot">/ </span>Roster</p>
        <h3 className="display" style={{ fontSize: 23, margin: "6px 0 18px" }}>{title}</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="field"><label>Name</label><input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
          <div className="field">
            <label>Committees</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {committees.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button key={c.id} type="button" className={"btn btn-sm" + (on ? " btn-primary" : " btn-ghost")} onClick={() => toggle(c.id)}>
                    {on && <Icon name="check" size={13} />} {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{busy ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </>
  );
}

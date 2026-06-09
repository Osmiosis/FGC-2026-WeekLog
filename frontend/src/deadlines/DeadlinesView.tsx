import { useState, type ChangeEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useDeadlines, useDeadlineProof, DEADLINE_CATEGORIES } from "../lib/hooks/useDeadlines";
import { useMediaUrl } from "../lib/hooks/useMediaUrl";
import type { Deadline, MediaRow, Rag } from "../lib/hooks/types";
import { Icon } from "../ui/Icon";
import { RagTag, ScreenHead, RAG_VAR, fmtDate } from "../ui/primitives";

// Days from today to an ISO date (UTC-safe, no tz drift).
function daysUntil(iso: string): number {
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  const b = Date.UTC(y, m - 1, d);
  return Math.round((b - a) / 86400000);
}

export function DeadlinesView({ wide }: { wide?: boolean }) {
  const { isAdmin } = useAuth();
  const { deadlines, error, create, markDone, reopen, remove } = useDeadlines();
  const [creating, setCreating] = useState(false);

  return (
    <div className="screen-in">
      <ScreenHead num="02" eyebrow="Deadlines" title="Standalone deadlines" wide={wide}
        sub="Social media challenges and other obligations that score points, tracked apart from meeting days." />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}

      <div className="stagger" style={{ display: "grid", gap: 12 }}>
        {deadlines.map((d) => (
          <DeadlineCard key={d.id} d={d} isAdmin={isAdmin}
            onDone={() => markDone(d.id)} onReopen={() => reopen(d.id)} onDelete={() => remove(d.id)} />
        ))}
      </div>

      {isAdmin && <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setCreating(true)}><Icon name="flag" size={16} /> New deadline</button>}

      {creating && <CreateDeadline onClose={() => setCreating(false)}
        onCreate={async (input) => { await create(input); setCreating(false); }} />}
    </div>
  );
}

function DeadlineCard({ d, isAdmin, onDone, onReopen, onDelete }: {
  d: Deadline; isAdmin: boolean; onDone: () => void; onReopen: () => void; onDelete: () => void;
}) {
  const done = d.status === "done";
  const du = daysUntil(d.due_date);
  const countdown = du < 0 ? `${-du} days overdue` : du === 0 ? "due today" : `in ${du} days`;
  const rag: Rag = done ? "green" : d.status_rag;
  return (
    <div className="card" style={{ borderLeft: `4px solid ${RAG_VAR[rag]}`, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            {d.category && <span className="mono-label" style={{ fontSize: 10, color: "var(--maroon-bright)" }}>{d.category.replace("_", " ")}</span>}
            {done ? <RagTag status="green">Done</RagTag> : <RagTag status={d.status_rag}>{d.status_rag === "red" ? "Overdue" : d.status_rag === "amber" ? "Due soon" : "On track"}</RagTag>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{d.title}</div>
          {d.description && <div style={{ fontSize: 14, color: "var(--fg-dim)", marginTop: 4 }}>{d.description}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span className="mono-label" style={{ fontSize: 10 }}>Due {fmtDate(d.due_date)}</span>
            {!done && <span className="mono-label" style={{ fontSize: 10, color: d.status_rag === "red" ? "var(--bad)" : "var(--warn)" }}>· {countdown}</span>}
            {d.link && <a href={d.link} target="_blank" rel="noreferrer" className="mono-label" style={{ fontSize: 10, color: "var(--maroon-bright)" }}>· reference ↗</a>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {!done ? <button className="btn btn-sm btn-primary" onClick={onDone}><Icon name="check" size={15} /> Mark done</button>
          : isAdmin && <button className="btn btn-sm" onClick={onReopen}>Reopen</button>}
        {isAdmin && <button className="btn btn-sm btn-ghost" style={{ color: "var(--fg-faint)" }} onClick={onDelete}>Delete</button>}
      </div>
      <Proof deadlineId={d.id} />
    </div>
  );
}

function Proof({ deadlineId }: { deadlineId: string }) {
  const { rows, upload } = useDeadlineProof(deadlineId);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Upload every selected file (the hook takes one at a time, so loop). You can
  // attach as many materials as you want before marking the deadline done.
  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same file be re-picked later
    if (!files.length) return;
    setErr(null);
    for (let i = 0; i < files.length; i++) {
      setProgress({ done: i, total: files.length });
      try {
        await upload(files[i]);
      } catch {
        setErr(`Could not upload "${files[i].name}". Files must be 10 MB or smaller.`);
        break;
      }
    }
    setProgress(null);
  };

  const busy = progress !== null;
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="mono-label" style={{ fontSize: 10 }}>
          Proof{rows.length > 0 ? ` (${rows.length})` : ""}
        </span>
        <label className="btn btn-sm" style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          <input type="file" multiple disabled={busy} style={{ display: "none" }} onChange={onPick} />
          <Icon name="download" size={15} style={{ transform: "rotate(180deg)" }} />{" "}
          {busy ? `Uploading ${progress!.done + 1}/${progress!.total}...` : rows.length > 0 ? "Attach more" : "Attach files"}
        </label>
      </div>
      {err && <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 8 }}>{err}</p>}
      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {rows.map((m) => <ProofThumb key={m.id} row={m} />)}
        </div>
      )}
    </div>
  );
}

function ProofThumb({ row }: { row: MediaRow }) {
  const url = useMediaUrl(row.id);
  const isImage = (row.content_type ?? "").startsWith("image/");
  if (!url) return <div className="thumb striped" style={{ width: 90, height: 64 }} />;
  return isImage
    ? <img src={url} alt={row.caption ?? ""} className="thumb" style={{ width: 90, height: 64, objectFit: "cover" }} />
    : <a className="thumb striped" href={url} target="_blank" rel="noreferrer" style={{ width: 90, height: 64, display: "flex" }}><span className="ph" style={{ width: "100%", fontSize: 10 }}>open</span></a>;
}

function CreateDeadline({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: { title: string; due_date: string; category?: string; link?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [cat, setCat] = useState(DEADLINE_CATEGORIES[0]);
  const [link, setLink] = useState("");
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal">
        <p className="eyebrow"><span className="dot">/ </span>New deadline</p>
        <h3 className="display" style={{ fontSize: 23, margin: "6px 0 18px" }}>Add a deadline</h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="field"><label>Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SM Challenge #4: ..." /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Due date</label><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Category</label>
              <select className="select" value={cat} onChange={(e) => setCat(e.target.value)}>
                {DEADLINE_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Reference link (optional)</label><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!title || !due} onClick={() => onCreate({ title, due_date: due, category: cat, link })}>Create</button>
        </div>
      </div>
    </>
  );
}

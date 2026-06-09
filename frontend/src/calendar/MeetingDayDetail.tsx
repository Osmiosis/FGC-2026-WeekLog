import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useMeetingDay } from "../lib/hooks/useMeetingDay";
import { useMediaUrl } from "../lib/hooks/useMediaUrl";
import { SUBSYSTEMS } from "../lib/hooks/useBrowse";
import type { Requirement, AvailableRequirement, AttendanceRow, Submission, MediaRow } from "../lib/hooks/types";
import { Icon } from "../ui/Icon";
import { RagTag, DividerNum, fmtDate } from "../ui/primitives";

// Map a requirement label to the submission kind it records (matches the API kinds).
function kindForLabel(label: string): string {
  if (label.includes("accomplishment")) return "accomplishment";
  if (label.includes("Build needs")) return "build_need";
  if (label.includes("Performance")) return "performance_goal";
  if (label.includes("Failure")) return "failure";
  if (label.includes("Strategy")) return "note";
  return "note";
}

export function MeetingDayDetail({ dayId, onBack }: { dayId: string; onBack: () => void }) {
  const { isAdmin } = useAuth();
  const day = useMeetingDay(dayId);
  const { detail, attendance, submissions, media, error, setPresent, addSubmission, uploadMedia, toggleCompulsory, removeRequirement, addRequirement, loadAvailable, rename, downloadZip } = day;

  const unmark = async () => {
    if (!confirm("Unmark this day? Its checklist and entries are removed.")) return;
    await day.unmark();
    onBack();
  };

  if (error) return <p style={{ color: "var(--bad)" }}>{error}</p>;
  if (!detail) return <p className="mono-label">Loading...</p>;

  const missing = detail.missingCompulsory;

  return (
    <div className="screen-in">
      <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", marginBottom: 12 }} onClick={onBack}>
        <Icon name="chevron" size={15} style={{ transform: "rotate(180deg)" }} /> Calendar
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p className="eyebrow"><span className="dot">/ </span>Meeting day</p>
          <h2 className="display" style={{ fontSize: 28, margin: "6px 0 2px", fontWeight: 700 }}>{fmtDate(detail.date, { weekday: "long", month: "long", day: "numeric" })}</h2>
          {isAdmin
            ? <TitleEditor title={detail.title} onSave={rename} />
            : detail.title && <div className="mono-label">{detail.title}</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={downloadZip}><Icon name="download" size={15} /> ZIP</button>
          {isAdmin && <button className="btn btn-sm" style={{ color: "var(--bad)" }} onClick={unmark}>Unmark</button>}
        </div>
      </div>

      {missing.length > 0 ? (
        <div className="rag red" style={{ margin: "16px 0", display: "flex", gap: 11, alignItems: "flex-start" }}>
          <Icon name="alert" size={18} style={{ color: "var(--bad)", flex: "none", marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "var(--bad)" }}>Still missing {missing.length} compulsory {missing.length === 1 ? "item" : "items"}</div>
            <div style={{ fontSize: 14, marginTop: 6, color: "var(--fg-dim)" }}>{missing.map((m) => m.label).join(", ")}</div>
          </div>
        </div>
      ) : (
        <div className="rag green" style={{ margin: "16px 0", display: "flex", gap: 11, alignItems: "center" }}>
          <Icon name="check" size={18} style={{ color: "var(--ok)", flex: "none" }} />
          <span style={{ fontWeight: 700, color: "var(--ok)" }}>All compulsory items submitted. Nice work.</span>
        </div>
      )}

      <div className="stagger" style={{ display: "grid", gap: 12 }}>
        {detail.requirements.map((r) => (
          <ReqCard key={r.id} req={r} isAdmin={isAdmin} attendance={attendance}
            onSetPresent={setPresent}
            onAddText={(content, subsystem) => addSubmission({ kind: kindForLabel(r.label), content, requirementId: r.id, subsystem })}
            onUpload={(file, kind, caption) => uploadMedia({ file, kind, caption, requirementId: r.id })}
            onToggleCompulsory={() => toggleCompulsory(r.id, r.compulsory ? 0 : 1)}
            onRemove={() => { if (confirm(`Remove "${r.label}" from this meeting? Uploaded files are kept.`)) removeRequirement(r.id); }} />
        ))}
      </div>

      {isAdmin && <AddRequirement onAdd={addRequirement} loadAvailable={loadAvailable} />}

      <Existing subs={submissions} mediaRows={media} />
    </div>
  );
}

function TitleEditor({ title, onSave }: { title: string | null; onSave: (t: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(title ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { await onSave(val.trim()); setEditing(false); } finally { setBusy(false); }
  };

  if (!editing) {
    return (
      <div className="mono-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {title || <span style={{ color: "var(--fg-faint)" }}>Untitled meeting</span>}
        <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => { setVal(title ?? ""); setEditing(true); }}>Rename</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
      <input className="input" style={{ minWidth: 180 }} value={val} placeholder="Meeting name" autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>Save</button>
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}

function ReqCard({
  req, isAdmin, attendance, onSetPresent, onAddText, onUpload, onToggleCompulsory, onRemove,
}: {
  req: Requirement;
  isAdmin: boolean;
  attendance: AttendanceRow[];
  onSetPresent: (memberId: string, present: number) => void;
  onAddText: (content: string, subsystem?: string) => void;
  onUpload: (file: File, kind: string, caption: string) => void;
  onToggleCompulsory: () => void;
  onRemove: () => void;
}) {
  const submitted = req.status === "submitted";
  const c = submitted ? "var(--ok)" : req.compulsory ? "var(--bad)" : "var(--line-2)";
  return (
    <div className="card" style={{ borderLeft: `4px solid ${c}`, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>{req.label} {!req.compulsory && <span className="mono-label" style={{ fontSize: 9 }}>· optional</span>}{req.custom ? <span className="mono-label" style={{ fontSize: 9 }}> · custom</span> : null}</div>
        </div>
        {submitted ? <RagTag status="green">Submitted</RagTag> : <RagTag status={req.compulsory ? "red" : "amber"}>Missing</RagTag>}
        {isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={onToggleCompulsory} title="Toggle compulsory for this meeting">Make {req.compulsory ? "voluntary" : "compulsory"}</button>
            <button className="btn btn-sm" style={{ color: "var(--bad)" }} onClick={onRemove} title="Remove from this meeting">Remove</button>
          </div>
        )}
      </div>

      {req.expected_kind === "attendance" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(184px, 1fr))", gap: 8, marginTop: 14 }}>
          {attendance.map((a) => {
            const on = !!a.present;
            return (
              <button key={a.member_id} className={"roster-chip" + (on ? " present" : "")} onClick={() => onSetPresent(a.member_id, on ? 0 : 1)}>
                <span className={"check" + (on ? " on" : "")}><Icon name="check" size={15} /></span>
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                  <span style={{ fontSize: 13.5, display: "block" }}>{a.name}</span>
                  {a.committee && <span className="mono-label" style={{ fontSize: 9 }}>{a.committee}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {req.expected_kind === "text" && !submitted && <TextSubmit onAdd={onAddText} />}
      {req.expected_kind === "media" && <MediaUpload onUpload={onUpload} />}
    </div>
  );
}

function TextSubmit({ onAdd }: { onAdd: (content: string, subsystem?: string) => void }) {
  const [text, setText] = useState("");
  const [sub, setSub] = useState("");
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      <textarea className="textarea" placeholder="Write what happened..." value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <select className="select" style={{ flex: 1 }} value={sub} onChange={(e) => setSub(e.target.value)}>
          <option value="">No subsystem</option>
          {SUBSYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!text} onClick={() => { if (text) { onAdd(text, sub || undefined); setText(""); } }}>Add</button>
      </div>
    </div>
  );
}

function MediaUpload({ onUpload }: { onUpload: (file: File, kind: string, caption: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [kind, setKind] = useState("photo");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try { await onUpload(file, kind, caption); setFile(null); setCaption(""); } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      <label className="thumb striped" style={{ height: 84, border: "1px dashed var(--line-2)", cursor: "pointer", background: "transparent", display: "flex" }}>
        <input type="file" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <span className="ph" style={{ flexDirection: "column", gap: 6, height: "100%", width: "100%" }}>
          <Icon name="download" size={20} style={{ transform: "rotate(180deg)" }} />
          <span className="mono-label" style={{ fontSize: 10 }}>{file ? file.name : "Tap to choose a photo or file"}</span>
        </span>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <select className="select" style={{ flex: 1, minWidth: 110 }} value={kind} onChange={(e) => setKind(e.target.value)}>
          {["photo", "sketch", "doc", "video"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!file || busy} onClick={submit}>{busy ? "Uploading..." : "Upload"}</button>
      </div>
    </div>
  );
}

const REQ_KINDS = ["text", "media", "attendance", "any"];

function AddRequirement({
  onAdd,
  loadAvailable,
}: {
  onAdd: (
    input: { templateId: string } | { label: string; compulsory: number; expectedKind: string }
  ) => Promise<void>;
  loadAvailable: () => Promise<AvailableRequirement[]>;
}) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableRequirement[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("text");
  const [compulsory, setCompulsory] = useState(true);
  const [busy, setBusy] = useState(false);

  const openPanel = async () => {
    setOpen(true);
    setAvailable(await loadAvailable());
  };

  const submitTemplate = async () => {
    if (!templateId) return;
    setBusy(true);
    try {
      await onAdd({ templateId });
      setTemplateId("");
      setAvailable(await loadAvailable());
    } finally {
      setBusy(false);
    }
  };

  const submitCustom = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onAdd({ label: label.trim(), compulsory: compulsory ? 1 : 0, expectedKind: kind });
      setLabel("");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="btn btn-sm" onClick={openPanel} style={{ marginTop: 12 }}>+ Add requirement</button>
    );
  }

  return (
    <div className="card" style={{ marginTop: 14, padding: 16, display: "grid", gap: 14, border: "1px dashed var(--line-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600 }}>Add requirement</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div className="mono-label" style={{ fontSize: 10 }}>From the default templates</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="select" style={{ flex: 1, minWidth: 160 }} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">{available.length ? "Choose a template..." : "(none available)"}</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>{t.label}{t.compulsory ? "" : " (optional)"}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={submitTemplate} disabled={!templateId || busy}>Add default</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div className="mono-label" style={{ fontSize: 10 }}>Or a custom one-off</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" style={{ flex: 2, minWidth: 180 }} placeholder="Requirement label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select className="select" style={{ minWidth: 110 }} value={kind} onChange={(e) => setKind(e.target.value)}>
            {REQ_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label className="mono-label" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={compulsory} onChange={(e) => setCompulsory(e.target.checked)} /> compulsory
          </label>
          <button className="btn btn-primary" onClick={submitCustom} disabled={!label.trim() || busy}>Add custom</button>
        </div>
      </div>
    </div>
  );
}

function Existing({ subs, mediaRows }: { subs: Submission[]; mediaRows: MediaRow[] }) {
  if (subs.length === 0 && mediaRows.length === 0) return null;
  return (
    <section style={{ marginTop: 26 }}>
      <DividerNum num="07" label="Submitted entries" />
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {subs.map((s) => (
          <div key={s.id} className="card" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="mono-label" style={{ fontSize: 10, color: "var(--maroon-bright)" }}>{s.kind.replace("_", " ")}</span>
              {s.subsystem && <span className="mono-label" style={{ fontSize: 10 }}>· {s.subsystem}</span>}
              {s.created_by && <span className="mono-label" style={{ fontSize: 10, marginLeft: "auto", color: "var(--fg-faint)" }}>{s.created_by}</span>}
            </div>
            <div style={{ fontSize: 14.5 }}>{s.content}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {mediaRows.map((m) => <Thumb key={m.id} row={m} />)}
      </div>
    </section>
  );
}

function Thumb({ row }: { row: MediaRow }) {
  const url = useMediaUrl(row.id);
  const isImage = (row.content_type ?? "").startsWith("image/");
  return (
    <div style={{ width: 140, fontSize: 12 }}>
      {url && isImage ? (
        <img src={url} alt={row.caption ?? ""} className="thumb" style={{ width: 140, height: 100, objectFit: "cover" }} />
      ) : url ? (
        <a className="thumb striped" href={url} target="_blank" rel="noreferrer" style={{ width: 140, height: 100, display: "flex" }}>
          <span className="ph" style={{ width: "100%" }}>Open {row.kind ?? "file"}</span>
        </a>
      ) : (
        <div className="thumb striped" style={{ width: 140, height: 100 }} />
      )}
      <div className="mono-label" style={{ fontSize: 10, marginTop: 4 }}>{row.caption}</div>
    </div>
  );
}

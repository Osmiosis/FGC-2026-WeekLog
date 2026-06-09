import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useMeetingDay } from "../lib/hooks/useMeetingDay";
import { useMediaUrl } from "../lib/hooks/useMediaUrl";
import { SUBSYSTEMS } from "../lib/hooks/useBrowse";
import type {
  Requirement,
  AvailableRequirement,
  AttendanceRow,
  Submission,
  MediaRow,
} from "../lib/hooks/types";

// Map a requirement label to the submission kind it records.
function kindForLabel(label: string): string {
  if (label.includes("accomplishment")) return "accomplishment";
  if (label.includes("Build needs")) return "build_need";
  if (label.includes("Performance")) return "performance_goal";
  if (label.includes("Failure")) return "failure";
  return "note";
}

export function MeetingDayDetail({ dayId, onBack }: { dayId: string; onBack: () => void }) {
  const { isAdmin } = useAuth();
  const day = useMeetingDay(dayId);
  const { detail, attendance, submissions, media, error, setPresent, addSubmission, uploadMedia, toggleCompulsory, removeRequirement, addRequirement, loadAvailable } = day;

  const unmark = async () => {
    if (!confirm("Unmark this day? Its checklist and entries are removed.")) return;
    await day.unmark();
    onBack();
  };

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!detail) return <p>Loading...</p>;

  return (
    <section>
      <button onClick={onBack}>Back to calendar</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>
          Meeting day {detail.date}
          {detail.title ? ` (${detail.title})` : ""}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={day.downloadZip}>Download day (ZIP)</button>
          {isAdmin && (
            <button onClick={unmark} style={{ color: "crimson" }}>
              Unmark this day
            </button>
          )}
        </div>
      </div>

      {detail.missingCompulsory.length > 0 ? (
        <div style={{ background: "#fff4f4", border: "1px solid #f3b4b4", padding: 12, margin: "12px 0" }}>
          <strong>Still missing (compulsory):</strong>{" "}
          {detail.missingCompulsory.map((m) => m.label).join(", ")}
        </div>
      ) : (
        <div style={{ background: "#eefcef", border: "1px solid #b4e0b8", padding: 12, margin: "12px 0" }}>
          <strong>All compulsory items submitted.</strong>
        </div>
      )}

      {detail.requirements.map((r) => (
        <RequirementCard
          key={r.id}
          req={r}
          isAdmin={isAdmin}
          attendance={attendance}
          onSetPresent={setPresent}
          onAddText={(content, subsystem) =>
            addSubmission({ kind: kindForLabel(r.label), content, requirementId: r.id, subsystem })
          }
          onUpload={(file, kind, caption) =>
            uploadMedia({ file, kind, caption, requirementId: r.id })
          }
          onToggleCompulsory={() => toggleCompulsory(r.id, r.compulsory ? 0 : 1)}
          onRemove={() => {
            if (confirm(`Remove "${r.label}" from this meeting? Uploaded files are kept.`)) {
              removeRequirement(r.id);
            }
          }}
        />
      ))}

      {isAdmin && <AddRequirement onAdd={addRequirement} loadAvailable={loadAvailable} />}

      <Existing subs={submissions} mediaRows={media} />
    </section>
  );
}

function RequirementCard({
  req,
  isAdmin,
  attendance,
  onSetPresent,
  onAddText,
  onUpload,
  onToggleCompulsory,
  onRemove,
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
  const border = submitted ? "#b4e0b8" : req.compulsory ? "#f3b4b4" : "#ddd";

  return (
    <div style={{ border: `1px solid ${border}`, borderLeft: `6px solid ${border}`, padding: 12, margin: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>
          {req.label} {req.compulsory ? "" : "(optional)"}
          {req.custom ? <span style={{ color: "#888", fontWeight: 400 }}> · custom</span> : ""}
        </strong>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{submitted ? "submitted" : "missing"}</span>
          {isAdmin && (
            <>
              <button
                onClick={onToggleCompulsory}
                title="Toggle whether this requirement is compulsory for this meeting"
                style={{ fontSize: 12 }}
              >
                Make {req.compulsory ? "voluntary" : "compulsory"}
              </button>
              <button onClick={onRemove} title="Remove from this meeting" style={{ fontSize: 12, color: "crimson" }}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      {req.expected_kind === "attendance" && (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 4 }}>
          {attendance.map((a) => (
            <label key={a.member_id} style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!a.present}
                onChange={(e) => onSetPresent(a.member_id, e.target.checked ? 1 : 0)}
              />{" "}
              {a.name}
            </label>
          ))}
        </div>
      )}

      {req.expected_kind === "text" && <TextSubmit onAdd={onAddText} />}
      {req.expected_kind === "media" && <MediaUpload onUpload={onUpload} />}
    </div>
  );
}

function TextSubmit({ onAdd }: { onAdd: (content: string, subsystem?: string) => void }) {
  const [text, setText] = useState("");
  const [subsystem, setSubsystem] = useState("");
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ flex: 1, minWidth: 200 }} />
      <select value={subsystem} onChange={(e) => setSubsystem(e.target.value)}>
        <option value="">(no subsystem)</option>
        {SUBSYSTEMS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!text) return;
          onAdd(text, subsystem || undefined);
          setText("");
        }}
      >
        Add
      </button>
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
    try {
      await onUpload(file, kind, caption);
      setFile(null);
      setCaption("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input placeholder="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        {["photo", "sketch", "doc", "video"].map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      <button onClick={submit} disabled={!file || busy}>
        {busy ? "Uploading..." : "Upload"}
      </button>
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
      <button onClick={openPanel} style={{ marginTop: 12 }}>
        + Add requirement
      </button>
    );
  }

  return (
    <div style={{ border: "1px dashed #bbb", padding: 12, margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Add requirement</strong>
        <button onClick={() => setOpen(false)} style={{ fontSize: 12 }}>
          Close
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>From the default templates</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">
              {available.length ? "Choose a template..." : "(none available)"}
            </option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.compulsory ? "" : " (optional)"}
              </option>
            ))}
          </select>
          <button onClick={submitTemplate} disabled={!templateId || busy}>
            Add default
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Or a custom one-off</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Requirement label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {REQ_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={compulsory} onChange={(e) => setCompulsory(e.target.checked)} />{" "}
            compulsory
          </label>
          <button onClick={submitCustom} disabled={!label.trim() || busy}>
            Add custom
          </button>
        </div>
      </div>
    </div>
  );
}

function Existing({ subs, mediaRows }: { subs: Submission[]; mediaRows: MediaRow[] }) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3>Submitted entries</h3>
      {subs.length === 0 && mediaRows.length === 0 && <p>Nothing submitted yet.</p>}
      <ul>
        {subs.map((s) => (
          <li key={s.id}>
            <strong>{s.kind}</strong>
            {s.subsystem ? ` [${s.subsystem}]` : ""}: {s.content}{" "}
            <span style={{ color: "#777", fontSize: 12 }}>{s.created_by}</span>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {mediaRows.map((m) => (
          <Thumb key={m.id} row={m} />
        ))}
      </div>
    </div>
  );
}

function Thumb({ row }: { row: MediaRow }) {
  const url = useMediaUrl(row.id);
  const isImage = (row.content_type ?? "").startsWith("image/");
  return (
    <div style={{ width: 140, fontSize: 12 }}>
      {url && isImage ? (
        <img src={url} alt={row.caption ?? ""} style={{ width: 140, height: 100, objectFit: "cover", border: "1px solid #ddd" }} />
      ) : url ? (
        <a href={url} target="_blank" rel="noreferrer">
          Open {row.kind ?? "file"}
        </a>
      ) : (
        <div style={{ width: 140, height: 100, background: "#f3f3f3" }} />
      )}
      <div>{row.caption}</div>
    </div>
  );
}

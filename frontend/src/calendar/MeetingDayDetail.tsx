import { useCallback, useEffect, useState } from "react";
import { api, apiForm, apiBlobUrl } from "../api";
import { useAuth } from "../auth/AuthProvider";

interface Requirement {
  id: string;
  label: string;
  compulsory: number;
  expected_kind: string | null;
  status: "submitted" | "missing";
}
interface Detail {
  id: string;
  date: string;
  title: string | null;
  requirements: Requirement[];
  missingCompulsory: Array<{ label: string }>;
}
interface AttendanceRow {
  member_id: string;
  name: string;
  committee: string | null;
  present: number;
}
interface Submission {
  id: string;
  kind: string;
  subsystem: string | null;
  content: string | null;
  created_by: string | null;
}
interface MediaRow {
  id: string;
  caption: string | null;
  kind: string | null;
  content_type: string | null;
  uploaded_by: string | null;
}

const SUBSYSTEMS = [
  "",
  "Drivetrain/Collector",
  "Shooter",
  "Climber",
  "Practice Arena",
  "Programming",
  "Strategy",
];

// Map a requirement label to the submission kind it records.
function kindForLabel(label: string): string {
  if (label.includes("accomplishment")) return "accomplishment";
  if (label.includes("Build needs")) return "build_need";
  if (label.includes("Performance")) return "performance_goal";
  if (label.includes("Failure")) return "failure";
  return "note";
}

export function MeetingDayDetail({
  dayId,
  onBack,
  onUnmarked,
}: {
  dayId: string;
  onBack: () => void;
  onUnmarked: () => void;
}) {
  const { isAdmin } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [d, a, s, m] = await Promise.all([
        api<Detail>(`/api/meeting-days/${dayId}`),
        api<AttendanceRow[]>(`/api/meeting-days/${dayId}/attendance`),
        api<Submission[]>(`/api/meeting-days/${dayId}/submissions`),
        api<MediaRow[]>(`/api/meeting-days/${dayId}/media`),
      ]);
      setDetail(d);
      setAttendance(a);
      setSubs(s);
      setMediaRows(m);
    } catch (e) {
      setErr(String(e));
    }
  }, [dayId]);

  useEffect(() => {
    load();
  }, [load]);

  const setPresent = async (member_id: string, present: number) => {
    await api(`/api/meeting-days/${dayId}/attendance`, {
      method: "POST",
      body: JSON.stringify({ member_id, present }),
    });
    load();
  };

  const unmark = async () => {
    if (!confirm("Unmark this day? Its checklist and entries are removed.")) return;
    await api(`/api/meeting-days/${dayId}`, { method: "DELETE" });
    onUnmarked();
  };

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!detail) return <p>Loading...</p>;

  return (
    <section>
      <button onClick={onBack}>Back to calendar</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>
          Meeting day {detail.date}
          {detail.title ? ` (${detail.title})` : ""}
        </h2>
        {isAdmin && (
          <button onClick={unmark} style={{ color: "crimson" }}>
            Unmark this day
          </button>
        )}
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
          dayId={dayId}
          req={r}
          attendance={attendance}
          onSetPresent={setPresent}
          onChanged={load}
        />
      ))}

      <Existing subs={subs} mediaRows={mediaRows} />
    </section>
  );
}

function RequirementCard({
  dayId,
  req,
  attendance,
  onSetPresent,
  onChanged,
}: {
  dayId: string;
  req: Requirement;
  attendance: AttendanceRow[];
  onSetPresent: (memberId: string, present: number) => void;
  onChanged: () => void;
}) {
  const submitted = req.status === "submitted";
  const border = submitted ? "#b4e0b8" : req.compulsory ? "#f3b4b4" : "#ddd";

  return (
    <div style={{ border: `1px solid ${border}`, borderLeft: `6px solid ${border}`, padding: 12, margin: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>
          {req.label} {req.compulsory ? "" : "(optional)"}
        </strong>
        <span>{submitted ? "submitted" : "missing"}</span>
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

      {req.expected_kind === "text" && (
        <TextSubmit dayId={dayId} kind={kindForLabel(req.label)} requirementId={req.id} onDone={onChanged} />
      )}

      {req.expected_kind === "media" && (
        <MediaUpload dayId={dayId} requirementId={req.id} onDone={onChanged} />
      )}
    </div>
  );
}

function TextSubmit({
  dayId,
  kind,
  requirementId,
  onDone,
}: {
  dayId: string;
  kind: string;
  requirementId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [subsystem, setSubsystem] = useState("");
  const add = async () => {
    if (!text) return;
    await api(`/api/meeting-days/${dayId}/submissions`, {
      method: "POST",
      body: JSON.stringify({ kind, content: text, requirement_id: requirementId, subsystem: subsystem || undefined }),
    });
    setText("");
    onDone();
  };
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ flex: 1, minWidth: 200 }} />
      <select value={subsystem} onChange={(e) => setSubsystem(e.target.value)}>
        {SUBSYSTEMS.map((s) => (
          <option key={s} value={s}>
            {s || "(no subsystem)"}
          </option>
        ))}
      </select>
      <button onClick={add}>Add</button>
    </div>
  );
}

function MediaUpload({
  dayId,
  requirementId,
  onDone,
}: {
  dayId: string;
  requirementId: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [kind, setKind] = useState("photo");
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("caption", caption);
    form.set("kind", kind);
    form.set("requirement_id", requirementId);
    try {
      await apiForm(`/api/meeting-days/${dayId}/media`, form);
      setFile(null);
      setCaption("");
      onDone();
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
      <button onClick={upload} disabled={!file || busy}>
        {busy ? "Uploading..." : "Upload"}
      </button>
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
          <MediaThumb key={m.id} row={m} />
        ))}
      </div>
    </div>
  );
}

function MediaThumb({ row }: { row: MediaRow }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    apiBlobUrl(`/api/media/${row.id}/file`)
      .then((u) => {
        made = u;
        if (live) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [row.id]);

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

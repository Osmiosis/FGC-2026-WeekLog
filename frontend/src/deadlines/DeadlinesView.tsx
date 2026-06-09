import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useDeadlines, useDeadlineProof, DEADLINE_CATEGORIES } from "../lib/hooks/useDeadlines";
import { useMediaUrl } from "../lib/hooks/useMediaUrl";
import type { Deadline, MediaRow, Rag } from "../lib/hooks/types";

const RAG_BORDER: Record<Rag, string> = { green: "#2f9e44", amber: "#e8a317", red: "#d6336c" };

export function DeadlinesView() {
  const { isAdmin } = useAuth();
  const { deadlines, error, markDone, reopen, remove } = useDeadlines();

  return (
    <section>
      <h2>Deadlines</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {isAdmin && <CreateDeadline />}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {deadlines.map((d: Deadline) => (
          <li
            key={d.id}
            style={{ borderLeft: `6px solid ${RAG_BORDER[d.status_rag]}`, padding: 12, margin: "8px 0", background: "#fafafa" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{d.title}</strong> {d.category ? `[${d.category}]` : ""}
                <div style={{ fontSize: 13, color: "#555" }}>
                  due {d.due_date} ({d.status})
                </div>
                {d.description && <div style={{ fontSize: 13 }}>{d.description}</div>}
                {d.link && (
                  <a href={d.link} target="_blank" rel="noreferrer">
                    reference link
                  </a>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                {d.status !== "done" ? (
                  <button onClick={() => markDone(d.id)}>Mark done</button>
                ) : (
                  isAdmin && <button onClick={() => reopen(d.id)}>Reopen</button>
                )}
                {isAdmin && (
                  <button onClick={() => remove(d.id)} style={{ color: "crimson" }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            <Proof deadlineId={d.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreateDeadline() {
  const { create } = useDeadlines();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState(DEADLINE_CATEGORIES[0]);
  const [link, setLink] = useState("");

  const onCreate = async () => {
    if (!title || !dueDate) return;
    await create({ title, due_date: dueDate, category, link });
    setTitle("");
    setDueDate("");
    setLink("");
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {DEADLINE_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input placeholder="Reference link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
      <button onClick={onCreate}>Add deadline</button>
    </div>
  );
}

function Proof({ deadlineId }: { deadlineId: string }) {
  const { rows, upload } = useDeadlineProof(deadlineId);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await upload(file);
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#555" }}>Proof:</span>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={submit} disabled={!file || busy}>
          {busy ? "Uploading..." : "Attach"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {rows.map((m: MediaRow) => (
          <Thumb key={m.id} row={m} />
        ))}
      </div>
    </div>
  );
}

function Thumb({ row }: { row: MediaRow }) {
  const url = useMediaUrl(row.id);
  const isImage = (row.content_type ?? "").startsWith("image/");
  if (!url) return <div style={{ width: 90, height: 64, background: "#eee" }} />;
  return isImage ? (
    <img src={url} alt={row.caption ?? ""} style={{ width: 90, height: 64, objectFit: "cover", border: "1px solid #ddd" }} />
  ) : (
    <a href={url} target="_blank" rel="noreferrer">
      open file
    </a>
  );
}

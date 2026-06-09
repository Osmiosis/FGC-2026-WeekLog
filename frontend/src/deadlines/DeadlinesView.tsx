import { useCallback, useEffect, useState } from "react";
import { api, apiForm, apiBlobUrl } from "../api";
import { useAuth } from "../auth/AuthProvider";

type Rag = "green" | "amber" | "red";

interface Deadline {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  due_date: string;
  status: string;
  status_rag: Rag;
  link: string | null;
}
interface MediaRow {
  id: string;
  caption: string | null;
  content_type: string | null;
}

const CATEGORIES = ["social_media", "design", "strategy", "other"];
const RAG_BORDER: Record<Rag, string> = { green: "#2f9e44", amber: "#e8a317", red: "#d6336c" };

export function DeadlinesView() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Deadline[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Deadline[]>("/api/deadlines").then(setItems).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const markDone = async (d: Deadline) => {
    await api(`/api/deadlines/${d.id}/done`, { method: "POST" });
    load();
  };
  const reopen = async (d: Deadline) => {
    await api(`/api/deadlines/${d.id}/reopen`, { method: "POST" });
    load();
  };
  const remove = async (d: Deadline) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    await api(`/api/deadlines/${d.id}`, { method: "DELETE" });
    load();
  };

  return (
    <section>
      <h2>Deadlines</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {isAdmin && <CreateDeadline onDone={load} />}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((d) => (
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
                  <button onClick={() => markDone(d)}>Mark done</button>
                ) : (
                  isAdmin && <button onClick={() => reopen(d)}>Reopen</button>
                )}
                {isAdmin && (
                  <button onClick={() => remove(d)} style={{ color: "crimson" }}>
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

function CreateDeadline({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [link, setLink] = useState("");

  const create = async () => {
    if (!title || !dueDate) return;
    await api("/api/deadlines", {
      method: "POST",
      body: JSON.stringify({ title, due_date: dueDate, category, link: link || undefined }),
    });
    setTitle("");
    setDueDate("");
    setLink("");
    onDone();
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input placeholder="Reference link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
      <button onClick={create}>Add deadline</button>
    </div>
  );
}

function Proof({ deadlineId }: { deadlineId: string }) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<MediaRow[]>(`/api/deadlines/${deadlineId}/media`).then(setRows).catch(() => {});
  }, [deadlineId]);
  useEffect(() => {
    load();
  }, [load]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "doc");
    try {
      await apiForm(`/api/deadlines/${deadlineId}/media`, form);
      setFile(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#555" }}>Proof:</span>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={upload} disabled={!file || busy}>
          {busy ? "Uploading..." : "Attach"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {rows.map((m) => (
          <Thumb key={m.id} row={m} />
        ))}
      </div>
    </div>
  );
}

function Thumb({ row }: { row: MediaRow }) {
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
  if (!url) return <div style={{ width: 90, height: 64, background: "#eee" }} />;
  return isImage ? (
    <img src={url} alt={row.caption ?? ""} style={{ width: 90, height: 64, objectFit: "cover", border: "1px solid #ddd" }} />
  ) : (
    <a href={url} target="_blank" rel="noreferrer">
      open file
    </a>
  );
}

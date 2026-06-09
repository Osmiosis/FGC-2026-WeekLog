import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

interface Sub {
  id: string;
  kind: string;
  subsystem: string | null;
  content: string | null;
  created_by: string | null;
  date: string;
  day_id?: string;
  meeting_day_id?: string;
  resolved?: number;
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
const KINDS = ["", "accomplishment", "build_need", "performance_goal", "failure", "note"];
const STATUSES = ["", "green", "amber", "red"];

export function BrowseView({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  return (
    <section>
      <OpenBuildNeeds onOpenDay={onOpenDay} />
      <Search onOpenDay={onOpenDay} />
    </section>
  );
}

function OpenBuildNeeds({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  const [rows, setRows] = useState<Sub[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(() => {
    const path = showResolved ? "/api/build-needs" : "/api/build-needs?open=1";
    api<Sub[]>(path).then(setRows).catch(() => {});
  }, [showResolved]);
  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (s: Sub, resolved: boolean) => {
    await api(`/api/submissions/${s.id}/${resolved ? "resolve" : "unresolve"}`, { method: "POST" });
    load();
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h2>Open build needs ({rows.filter((r) => !r.resolved).length})</h2>
      <label style={{ fontSize: 13 }}>
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> show
        resolved
      </label>
      {rows.length === 0 ? (
        <p>No open build needs.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {rows.map((s) => (
            <li
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: 8,
                borderLeft: `6px solid ${s.resolved ? "#2f9e44" : "#e8a317"}`,
                background: "#fafafa",
                margin: "6px 0",
              }}
            >
              <div>
                <strong>{s.content}</strong>{" "}
                {s.subsystem ? <span style={{ fontSize: 12 }}>[{s.subsystem}]</span> : null}
                <div style={{ fontSize: 12, color: "#666" }}>{s.date}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onOpenDay((s.meeting_day_id ?? s.day_id)!)}>Open day</button>
                {s.resolved ? (
                  <button onClick={() => resolve(s, false)}>Reopen</button>
                ) : (
                  <button onClick={() => resolve(s, true)}>Resolve</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Search({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [subsystem, setSubsystem] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Sub[]>([]);
  const [ran, setRan] = useState(false);

  const run = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (subsystem) params.set("subsystem", subsystem);
    if (kind) params.set("kind", kind);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    const res = await api<Sub[]>(`/api/search?${params.toString()}`);
    setRows(res);
    setRan(true);
  };

  return (
    <div>
      <h2>Search submissions</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input placeholder="Text" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={subsystem} onChange={(e) => setSubsystem(e.target.value)}>
          {SUBSYSTEMS.map((s) => (
            <option key={s} value={s}>
              {s || "any subsystem"}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k || "any kind"}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || "any status"}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 13 }}>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 13 }}>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={run}>Search</button>
      </div>

      {ran && rows.length === 0 && <p>No matches.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {rows.map((s) => (
          <li key={s.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>{s.kind}</strong>
            {s.subsystem ? ` [${s.subsystem}]` : ""}: {s.content}{" "}
            <span style={{ color: "#777", fontSize: 12 }}>
              {s.date} {s.created_by}
            </span>{" "}
            <button onClick={() => onOpenDay((s.meeting_day_id ?? s.day_id)!)}>open day</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

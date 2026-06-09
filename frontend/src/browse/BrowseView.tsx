import { useState } from "react";
import {
  useBuildNeeds,
  useSearch,
  SUBSYSTEMS,
  SUBMISSION_KINDS,
} from "../lib/hooks/useBrowse";
import type { Submission } from "../lib/hooks/types";

const STATUSES = ["", "green", "amber", "red"];

function dayIdOf(s: Submission): string {
  return (s.meeting_day_id ?? s.day_id) as string;
}

export function BrowseView({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  return (
    <section>
      <OpenBuildNeeds onOpenDay={onOpenDay} />
      <Search onOpenDay={onOpenDay} />
    </section>
  );
}

function OpenBuildNeeds({ onOpenDay }: { onOpenDay: (id: string) => void }) {
  const [showResolved, setShowResolved] = useState(false);
  const { rows, setResolved } = useBuildNeeds(showResolved);

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
                <button onClick={() => onOpenDay(dayIdOf(s))}>Open day</button>
                {s.resolved ? (
                  <button onClick={() => setResolved(s.id, false)}>Reopen</button>
                ) : (
                  <button onClick={() => setResolved(s.id, true)}>Resolve</button>
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
  const { results, ran, run } = useSearch();
  const [q, setQ] = useState("");
  const [subsystem, setSubsystem] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  return (
    <div>
      <h2>Search submissions</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input placeholder="Text" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={subsystem} onChange={(e) => setSubsystem(e.target.value)}>
          <option value="">any subsystem</option>
          {SUBSYSTEMS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">any kind</option>
          {SUBMISSION_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
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
        <button onClick={() => run({ q, subsystem, kind, from, to, status })}>Search</button>
      </div>

      {ran && results.length === 0 && <p>No matches.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {results.map((s) => (
          <li key={s.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>{s.kind}</strong>
            {s.subsystem ? ` [${s.subsystem}]` : ""}: {s.content}{" "}
            <span style={{ color: "#777", fontSize: 12 }}>
              {s.date} {s.created_by}
            </span>{" "}
            <button onClick={() => onOpenDay(dayIdOf(s))}>open day</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

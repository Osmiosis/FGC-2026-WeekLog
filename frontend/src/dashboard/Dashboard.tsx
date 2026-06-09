import { useEffect, useState } from "react";
import { api } from "../api";

type Rag = "green" | "amber" | "red";

interface Dash {
  today: string;
  overall: Rag;
  counts: { daysFlagged: number; deadlinesOverdue: number; deadlinesDueSoon: number };
  needsAttention: Array<{
    type: "day" | "deadline";
    id: string;
    date?: string;
    due_date?: string;
    label: string;
  }>;
  thisWeek: Array<{ id: string; date: string; status: Rag }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    due_date: string;
    status: Rag;
    daysUntil: number;
  }>;
}

const RAG: Record<Rag, { bg: string; border: string; text: string }> = {
  green: { bg: "#e7f6e9", border: "#2f9e44", text: "All on track" },
  amber: { bg: "#fff4e0", border: "#e8a317", text: "Attention soon" },
  red: { bg: "#fdeaea", border: "#d6336c", text: "Action needed" },
};

export function Dashboard({
  onOpenDay,
  onGoToDeadlines,
}: {
  onOpenDay: (id: string) => void;
  onGoToDeadlines: () => void;
}) {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Dash>("/api/dashboard").then(setD).catch((e) => setErr(String(e)));
  }, []);

  if (err) return <p style={{ color: "crimson" }}>{err}</p>;
  if (!d) return <p>Loading...</p>;

  const rag = RAG[d.overall];

  return (
    <section>
      <div
        style={{
          background: rag.bg,
          border: `2px solid ${rag.border}`,
          padding: 20,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: rag.border }}>{rag.text}</div>
        <div style={{ fontSize: 14, marginTop: 4 }}>
          {d.counts.daysFlagged} day(s) flagged, {d.counts.deadlinesOverdue} deadline(s) overdue,{" "}
          {d.counts.deadlinesDueSoon} due soon.
        </div>
      </div>

      <h3>Needs attention</h3>
      {d.needsAttention.length === 0 ? (
        <p>Nothing flagged. Nice work.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {d.needsAttention.map((n) => (
            <li key={`${n.type}-${n.id}`} style={{ margin: "6px 0" }}>
              <button
                onClick={() => (n.type === "day" ? onOpenDay(n.id) : onGoToDeadlines())}
                style={{
                  textAlign: "left",
                  width: "100%",
                  padding: 10,
                  border: `1px solid ${RAG.red.border}`,
                  background: RAG.red.bg,
                  cursor: "pointer",
                }}
              >
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>This week</h3>
      {d.thisWeek.length === 0 ? (
        <p>No meeting days this week.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {d.thisWeek.map((day) => (
            <button
              key={day.id}
              onClick={() => onOpenDay(day.id)}
              style={{
                padding: "8px 12px",
                background: RAG[day.status].bg,
                border: `2px solid ${RAG[day.status].border}`,
                cursor: "pointer",
              }}
            >
              {day.date}
            </button>
          ))}
        </div>
      )}

      <h3>Upcoming deadlines</h3>
      {d.upcomingDeadlines.length === 0 ? (
        <p>No open deadlines.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {d.upcomingDeadlines.map((u) => (
            <li
              key={u.id}
              onClick={onGoToDeadlines}
              style={{
                margin: "6px 0",
                padding: 10,
                borderLeft: `6px solid ${RAG[u.status].border}`,
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              <strong>{u.title}</strong> ({u.due_date}){" "}
              {u.daysUntil < 0
                ? `${-u.daysUntil} day(s) overdue`
                : u.daysUntil === 0
                ? "due today"
                : `in ${u.daysUntil} day(s)`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

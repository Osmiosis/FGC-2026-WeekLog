import { useEffect, useState } from "react";
import { api } from "../api";

interface Template {
  id: string;
  label: string;
  description: string | null;
  compulsory: number;
  expected_kind: string | null;
  active: number;
  sort_order: number | null;
}

const KINDS = ["attendance", "text", "media", "any"];

export function TemplatesAdmin() {
  const [items, setItems] = useState<Template[]>([]);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("text");
  const [compulsory, setCompulsory] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<Template[]>("/api/requirement-templates")
      .then(setItems)
      .catch((e) => setErr(String(e)));

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!label) return;
    await api("/api/requirement-templates", {
      method: "POST",
      body: JSON.stringify({
        label,
        expected_kind: kind,
        compulsory: compulsory ? 1 : 0,
      }),
    });
    setLabel("");
    load();
  };

  const patch = async (t: Template, body: Partial<Template>) => {
    await api(`/api/requirement-templates/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    await api("/api/requirement-templates/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: next.map((t) => t.id) }),
    });
    load();
  };

  return (
    <section>
      <h2>Requirement templates</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={compulsory}
            onChange={(e) => setCompulsory(e.target.checked)}
          />{" "}
          Compulsory
        </label>
        <button onClick={add}>Add</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Order</th>
            <th align="left">Label</th>
            <th>Kind</th>
            <th>Compulsory</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t, i) => (
            <tr key={t.id} style={{ opacity: t.active ? 1 : 0.5 }}>
              <td align="center">
                <button onClick={() => move(i, -1)} disabled={i === 0}>
                  up
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  down
                </button>
              </td>
              <td>{t.label}</td>
              <td align="center">{t.expected_kind}</td>
              <td align="center">
                <input
                  type="checkbox"
                  checked={!!t.compulsory}
                  onChange={() => patch(t, { compulsory: t.compulsory ? 0 : 1 })}
                />
              </td>
              <td align="center">{t.active ? "yes" : "no"}</td>
              <td>
                <button onClick={() => patch(t, { active: t.active ? 0 : 1 })}>
                  {t.active ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

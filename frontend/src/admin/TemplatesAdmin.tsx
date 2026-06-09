import { useState } from "react";
import { useTemplates, EXPECTED_KINDS } from "../lib/hooks/useTemplates";
import type { Template } from "../lib/hooks/types";

export function TemplatesAdmin() {
  const { templates, error, add, patch, reorder } = useTemplates();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("text");
  const [compulsory, setCompulsory] = useState(true);

  const onAdd = async () => {
    if (!label) return;
    await add(label, kind, compulsory);
    setLabel("");
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...templates];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    reorder(next);
  };

  return (
    <section>
      <h2>Requirement templates</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {EXPECTED_KINDS.map((k) => (
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
        <button onClick={onAdd}>Add</button>
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
          {templates.map((t: Template, i) => (
            <tr key={t.id} style={{ opacity: t.active ? 1 : 0.5 }}>
              <td align="center">
                <button onClick={() => move(i, -1)} disabled={i === 0}>
                  up
                </button>
                <button onClick={() => move(i, 1)} disabled={i === templates.length - 1}>
                  down
                </button>
              </td>
              <td>{t.label}</td>
              <td align="center">{t.expected_kind}</td>
              <td align="center">
                <input
                  type="checkbox"
                  checked={!!t.compulsory}
                  onChange={() => patch(t.id, { compulsory: t.compulsory ? 0 : 1 })}
                />
              </td>
              <td align="center">{t.active ? "yes" : "no"}</td>
              <td>
                <button onClick={() => patch(t.id, { active: t.active ? 0 : 1 })}>
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

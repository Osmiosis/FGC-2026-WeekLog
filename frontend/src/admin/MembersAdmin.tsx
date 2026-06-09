import { useEffect, useState } from "react";
import { api } from "../api";

interface Member {
  id: string;
  name: string;
  committee: string | null;
  active: number;
}

const COMMITTEES = [
  "Outreach",
  "Design",
  "Notebook",
  "Strategy",
  "Drivetrain/Collector",
  "Shooter",
  "Climber",
  "Practice Arena",
  "Programming",
];

export function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [committee, setCommittee] = useState(COMMITTEES[0]);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<Member[]>("/api/members").then(setMembers).catch((e) => setErr(String(e)));

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name) return;
    await api("/api/members", {
      method: "POST",
      body: JSON.stringify({ name, committee }),
    });
    setName("");
    load();
  };

  const toggleActive = async (m: Member) => {
    await api(`/api/members/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: m.active ? 0 : 1 }),
    });
    load();
  };

  const rename = async (m: Member, newName: string) => {
    await api(`/api/members/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: newName }),
    });
    load();
  };

  return (
    <section>
      <h2>Members</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={committee} onChange={(e) => setCommittee(e.target.value)}>
          {COMMITTEES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={add}>Add member</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Name</th>
            <th align="left">Committee</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
              <td>
                <input
                  defaultValue={m.name}
                  onBlur={(e) =>
                    e.target.value !== m.name && rename(m, e.target.value)
                  }
                />
              </td>
              <td>{m.committee}</td>
              <td align="center">{m.active ? "yes" : "no"}</td>
              <td>
                <button onClick={() => toggleActive(m)}>
                  {m.active ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

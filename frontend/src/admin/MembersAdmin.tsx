import { useState } from "react";
import { useMembers, COMMITTEES } from "../lib/hooks/useMembers";

export function MembersAdmin() {
  const { members, error, addMember, rename, setActive } = useMembers();
  const [name, setName] = useState("");
  const [committee, setCommittee] = useState(COMMITTEES[0]);

  const add = async () => {
    if (!name) return;
    await addMember(name, committee);
    setName("");
  };

  return (
    <section>
      <h2>Members</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
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
                  onBlur={(e) => e.target.value !== m.name && rename(m.id, e.target.value)}
                />
              </td>
              <td>{m.committee}</td>
              <td align="center">{m.active ? "yes" : "no"}</td>
              <td>
                <button onClick={() => setActive(m.id, m.active ? 0 : 1)}>
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

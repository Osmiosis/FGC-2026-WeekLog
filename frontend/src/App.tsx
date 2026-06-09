import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? "online" : "degraded"))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Team Qatar FGC 2026</h1>
      <p>Meeting Compliance and Documentation Tracker</p>
      <p>Worker status: {health}</p>
    </main>
  );
}

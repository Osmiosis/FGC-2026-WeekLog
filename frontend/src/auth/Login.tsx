import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

const card: React.CSSProperties = {
  fontFamily: "system-ui",
  maxWidth: 400,
  margin: "10vh auto",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const input: React.CSSProperties = { padding: 8, width: "100%", boxSizing: "border-box" };
const btn: React.CSSProperties = { padding: "8px 12px", cursor: "pointer" };

export function Login() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendMagicLink(email);
    setBusy(false);
    if (error) setError(error);
    else setSent(true);
  };

  if (sent) {
    return (
      <div style={card}>
        <h2>Check your email</h2>
        <p>We sent a sign in link to {email}. Open it on this device to continue.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={card}>
      <h1>Team Qatar FGC 2026</h1>
      <p>Meeting Compliance and Documentation Tracker</p>
      <label>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={input}
        />
      </label>
      <button type="submit" disabled={busy} style={btn}>
        {busy ? "Sending..." : "Send magic link"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}

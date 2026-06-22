import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { Icon } from "../ui/Icon";

// Passwordless magic-link login. Keeps the useAuth().sendMagicLink contract;
// all styling lives in the theme CSS. In the open-access model this is shown
// on demand (admins only); onBack dismisses it back to the public app.
export function Login({ onBack }: { onBack?: () => void } = {}) {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendMagicLink(email);
    setBusy(false);
    if (error) setError(error);
    else setSent(true);
  };

  return (
    <div className="tq" style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 46, borderLeft: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="rail-label" style={{ letterSpacing: ".4em" }}>LOG · TRACK · REPORT · WIN</div>
      </div>

      <div style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "8vh 28px 6vh", paddingRight: 74 }}>
        {onBack && (
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 22 }} onClick={onBack}>
            <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} /> Back to logbook
          </button>
        )}
        <div className="serration" style={{ width: 120, marginBottom: 30 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <img src="/team-qatar-logo.png" className="logo-badge" style={{ width: 54, height: 54 }} alt="Team Qatar" />
          <div>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap" }}>TEAM QATAR</div>
            <div className="mono-label" style={{ fontSize: 10 }}>FGC 2026</div>
          </div>
        </div>

        {!sent ? (
          <>
            <p className="eyebrow" style={{ marginBottom: 18 }}><span className="dot">/ </span>Meeting compliance & documentation</p>
            <h1 className="display" style={{ fontSize: "clamp(40px, 9vw, 68px)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-0.02em" }}>
              THE TEAM<br /><span style={{ color: "var(--maroon-bright)" }}>LOGBOOK</span>
            </h1>
            <p style={{ color: "var(--fg-dim)", fontSize: 16, marginTop: 18, maxWidth: 400 }}>
              Every meeting, every deadline, one red, amber, green view of how your documentation is doing.
            </p>

            <form onSubmit={submit} style={{ marginTop: 40, maxWidth: 400 }}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label htmlFor="login-email">Email address</label>
                <input id="login-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@teamqatar.qa" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", minHeight: 50 }}>
                {busy ? "Sending..." : <>Send magic link <Icon name="arrow" size={17} /></>}
              </button>
              {error && <p style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</p>}
              <p className="mono-label" style={{ fontSize: 10, marginTop: 14, color: "var(--fg-faint)", lineHeight: 1.6 }}>
                No password. We email a one-tap sign in link that returns you right here.
              </p>
            </form>

            <div style={{ marginTop: 46, fontFamily: "var(--mono)", fontSize: 14, color: "var(--fg-faint)", lineHeight: 1.9 }}>
              <div>&lt;START.</div>
              <div style={{ color: "var(--maroon-bright)", paddingLeft: 24 }}>DOCUMENTING.</div>
              <div style={{ paddingLeft: 48 }}>ON. THE. GO /&gt;</div>
            </div>
          </>
        ) : (
          <div className="screen-in">
            <p className="eyebrow" style={{ marginBottom: 18 }}><span className="dot">/ </span>Check your inbox</p>
            <h1 className="display" style={{ fontSize: "clamp(34px, 7vw, 52px)", fontWeight: 700, lineHeight: 1 }}>Link sent</h1>
            <p style={{ color: "var(--fg-dim)", fontSize: 16, marginTop: 16, maxWidth: 380 }}>
              We sent a sign in link to <strong style={{ color: "var(--fg)" }}>{email}</strong>. Open it on this device to continue.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => setSent(false)}>Use a different email</button>
          </div>
        )}
      </div>
    </div>
  );
}

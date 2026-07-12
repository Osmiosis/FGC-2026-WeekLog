import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { GOOGLE_CLIENT_ID, DEMO_BYPASS } from "../lib/auth-client";

// Passwordless Google sign-in via Google Identity Services (ID-token flow).
// GIS renders its own button; on credential we exchange the ID token for a
// Better Auth session. No email, no redirect, no rate limits.
declare global {
  interface Window {
    google?: any;
  }
}

export function Login() {
  const { signInWithGoogle, demoSignIn } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return setError("No credential from Google.");
          const { error } = await signInWithGoogle(resp.credential);
          if (error) setError(error);
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
      });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [signInWithGoogle]);

  return (
    <div className="tq" style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 46, borderLeft: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="rail-label" style={{ letterSpacing: ".4em" }}>LOG · TRACK · REPORT · WIN</div>
      </div>
      <div style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "8vh 28px 6vh", paddingRight: 74 }}>
        <div className="serration" style={{ width: 120, marginBottom: 30 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <img src="/team-qatar-logo.png" className="logo-badge" style={{ width: 54, height: 54 }} alt="Team Qatar" />
          <div>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap" }}>TEAM QATAR</div>
            <div className="mono-label" style={{ fontSize: 10 }}>FGC 2026</div>
          </div>
        </div>
        <p className="eyebrow" style={{ marginBottom: 18 }}><span className="dot">/ </span>Meeting compliance &amp; documentation</p>
        <h1 className="display" style={{ fontSize: "clamp(40px, 9vw, 68px)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-0.02em" }}>
          THE TEAM<br /><span style={{ color: "var(--maroon-bright)" }}>LOGBOOK</span>
        </h1>
        <p style={{ color: "var(--fg-dim)", fontSize: 16, marginTop: 18, maxWidth: 400 }}>
          Every meeting, every deadline, one red, amber, green view of how your documentation is doing.
        </p>
        <div style={{ marginTop: 40 }} ref={btnRef} />
        {DEMO_BYPASS && (
          <button
            onClick={demoSignIn}
            className="btn"
            style={{ marginTop: 16, padding: "12px 22px", borderRadius: 999, fontWeight: 600 }}
          >
            Enter as reviewer — no Google needed
          </button>
        )}
        {error && <p style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</p>}
        <p className="mono-label" style={{ fontSize: 10, marginTop: 14, color: "var(--fg-faint)", lineHeight: 1.6 }}>
          One tap with Google. No password, no email link.{DEMO_BYPASS && " Demo build: reviewer access needs no sign-in."}
        </p>
      </div>
    </div>
  );
}

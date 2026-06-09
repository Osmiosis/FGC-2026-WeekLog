import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Rag } from "../lib/hooks/types";
import { Icon, type IconName } from "./Icon";

// status -> icon + CSS var color
export const RAG_ICON: Record<Rag, IconName> = { green: "check", amber: "clock", red: "alert" };
export const RAG_VAR: Record<Rag, string> = { green: "var(--ok)", amber: "var(--warn)", red: "var(--bad)" };

// Small inline status tag: icon + label, never color alone.
export function RagTag({ status, children }: { status: Rag; children: ReactNode }) {
  return (
    <span className={`tag ${status}`}>
      <Icon name={RAG_ICON[status]} size={13} />
      {children}
    </span>
  );
}

// Team Qatar brand lockup (logo badge + wordmark).
export function Brand({ size = 32, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/team-qatar-logo.png" className="logo-badge" style={{ width: size, height: size }} alt="Team Qatar" />
      <div style={{ lineHeight: 1.1 }}>
        <div className="display" style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap" }}>TEAM QATAR</div>
        {sub && <div className="mono-label" style={{ fontSize: 9, color: "var(--fg-faint)" }}>FGC 2026 · LOGBOOK</div>}
      </div>
    </div>
  );
}

// Numbered editorial screen header. On wide layouts the app shell already shows
// the page title, so only the subtitle is rendered to avoid duplication.
export function ScreenHead({
  num, eyebrow, title, sub, wide,
}: { num: string; eyebrow: string; title: string; sub?: string; wide?: boolean }) {
  if (wide) {
    return sub
      ? <p style={{ color: "var(--fg-dim)", fontSize: 14.5, margin: "-6px 0 24px", maxWidth: 520 }}>{sub}</p>
      : <div style={{ height: 4 }} />;
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="index-num" style={{ fontSize: 13 }}>{num}</span>
        <p className="eyebrow"><span className="dot">/ </span>{eyebrow}</p>
      </div>
      <h2 className="display" style={{ fontSize: 27, margin: "6px 0 4px", fontWeight: 700 }}>{title}</h2>
      {sub && <p style={{ color: "var(--fg-dim)", fontSize: 14, margin: 0, maxWidth: 460 }}>{sub}</p>}
    </div>
  );
}

export function DividerNum({ num, label }: { num: string; label: string }) {
  return (
    <div className="divider-num">
      <span className="index-num" style={{ fontSize: 13 }}>{num}</span>
      <p className="eyebrow" style={{ margin: 0 }}>{label}</p>
      <span className="ln" />
    </div>
  );
}

// True when the viewport is laptop-width (sidebar layout). Below this we use the
// phone bottom-tab layout.
export function useWide(breakpoint = 900) {
  const [wide, setWide] = useState(() => window.innerWidth >= breakpoint);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= breakpoint);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [breakpoint]);
  return wide;
}

// Format an ISO date (YYYY-MM-DD) without timezone drift.
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(iso + "T00:00").toLocaleDateString("en-US", opts);
}

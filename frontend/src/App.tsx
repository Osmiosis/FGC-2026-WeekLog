import { useState } from "react";
import { isConfigured } from "./lib/supabase";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Login } from "./auth/Login";
import { Dashboard } from "./dashboard/Dashboard";
import { CalendarView } from "./calendar/CalendarView";
import { DeadlinesView } from "./deadlines/DeadlinesView";
import { BrowseView } from "./browse/BrowseView";
import { MembersAdmin } from "./admin/MembersAdmin";
import { TemplatesAdmin } from "./admin/TemplatesAdmin";
import { Icon, type IconName } from "./ui/Icon";
import { Brand, useWide } from "./ui/primitives";

type Tab = "dashboard" | "calendar" | "deadlines" | "browse" | "members" | "templates";

// Desktop sidebar shows all of MAIN; the mobile bottom bar shows only BAR (Members overflows to "More").
const MAIN: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "deadlines", label: "Deadlines", icon: "flag" },
  { id: "browse", label: "Browse", icon: "search" },
  { id: "members", label: "Members", icon: "users" },
];
const BAR = MAIN.slice(0, 4);
const MEMBERS_TAB = MAIN[4];
const ADMIN: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: "templates", label: "Requirements", icon: "list" },
];

const TITLE: Record<Tab, string> = {
  dashboard: "Documentation health",
  calendar: "Meeting days",
  deadlines: "Deadlines",
  browse: "Find anything",
  members: "Members",
  templates: "Requirements",
};

function Shell() {
  const { session, email, isAdmin, loading, signOut } = useAuth();
  const wide = useWide();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [calendarDayId, setCalendarDayId] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const openDay = (id: string) => { setCalendarDayId(id); setTab("calendar"); };
  const go = (t: Tab) => { setCalendarDayId(null); setTab(t); setMore(false); };

  if (loading) return <div className="tq" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><p className="mono-label">Loading...</p></div>;
  // Open access: no login wall. The app is public; admins sign in on demand to
  // unlock admin controls. The overlay auto-dismisses once isAdmin flips true.
  if (showLogin && !isAdmin) return <Login onBack={() => setShowLogin(false)} />;

  const labelFor = (t: Tab) => MAIN.concat(ADMIN).find((x) => x.id === t)?.label ?? "";

  const Content = (
    <div key={tab + (calendarDayId ?? "")} style={{ animation: "screenIn .34s cubic-bezier(.2,.8,.2,1)" }}>
      {tab === "dashboard" && <Dashboard wide={wide} onOpenDay={openDay} onGoToDeadlines={() => go("deadlines")} />}
      {tab === "calendar" && <CalendarView initialOpenDayId={calendarDayId} />}
      {tab === "deadlines" && <DeadlinesView wide={wide} />}
      {tab === "browse" && <BrowseView onOpenDay={openDay} wide={wide} />}
      {tab === "members" && <MembersAdmin readOnly={!isAdmin} />}
      {tab === "templates" && isAdmin && <TemplatesAdmin />}
    </div>
  );

  // ---------------------------------------------------- desktop: sidebar
  if (wide) {
    return (
      <div className="tq" style={{ height: "100vh", display: "flex" }}>
        <aside style={{ flex: "none", width: 256, borderRight: "1px solid var(--line)", background: "var(--ink-1)", display: "flex", flexDirection: "column", padding: "24px 16px" }}>
          <div style={{ padding: "0 8px 22px" }}><Brand size={38} /></div>
          <nav style={{ display: "grid", gap: 3 }}>{MAIN.map((t) => <NavItem key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />)}</nav>
          {isAdmin && <>
            <div className="mono-label" style={{ fontSize: 9, padding: "20px 12px 8px", color: "var(--fg-faint)" }}>/ Admin</div>
            <nav style={{ display: "grid", gap: 3 }}>{ADMIN.map((t) => <NavItem key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />)}</nav>
          </>}
          <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            {isAdmin ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 50, background: "var(--maroon)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--disp)", fontWeight: 700, fontSize: 13, flex: "none" }}>{(email ?? "?").slice(0, 2).toUpperCase()}</div>
                <div style={{ lineHeight: 1.2, overflow: "hidden", flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
                  <div className="mono-label" style={{ fontSize: 9 }}>Admin</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: 34, padding: 0, justifyContent: "center" }} onClick={signOut} title="Sign out"><Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} /></button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={() => setShowLogin(true)}>Admin sign in</button>
            )}
          </div>
        </aside>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <header style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 36px", borderBottom: "1px solid var(--line)" }}>
            <div>
              <p className="eyebrow"><span className="dot">/ </span>{labelFor(tab)}</p>
              <h1 className="display" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{TITLE[tab]}</h1>
            </div>
            <button className="btn btn-sm" style={{ width: 40, padding: 0, justifyContent: "center" }} aria-label="Notifications"><Icon name="bell" size={18} /></button>
          </header>
          <div style={{ flex: 1, overflow: "auto", padding: "32px 36px 56px" }}><div style={{ maxWidth: 1000 }}>{Content}</div></div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------- mobile: bottom tabs
  return (
    <div className="tq" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <header style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <Brand size={32} />
        <button className="btn btn-ghost btn-sm" style={{ width: 38, padding: 0, justifyContent: "center" }} aria-label="Notifications"><Icon name="bell" size={19} /></button>
      </header>
      <div style={{ flex: 1, overflow: "auto", padding: "22px 18px 30px" }}>{Content}</div>

      <nav style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", alignItems: "center", padding: "8px 8px calc(8px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)", background: "var(--ink-1)" }}>
        {BAR.map((t) => <TabBtn key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />)}
        <TabBtn t={{ label: "More", icon: "list" }} active={more || tab === "members"} onClick={() => setMore(true)} />
      </nav>

      {more && (
        <>
          <div className="scrim" onClick={() => setMore(false)} />
          <div className="sheet">
            <div className="grab" />
            <p className="eyebrow"><span className="dot">/ </span>Menu</p>
            <div style={{ display: "grid", gap: 6, margin: "14px 0 18px" }}>
              {[MEMBERS_TAB, ...(isAdmin ? ADMIN : [])].map((t) => (
                <button key={t.id} className="roster-chip" style={{ background: "var(--ink)" }} onClick={() => go(t.id)}>
                  <Icon name={t.icon} size={18} /> <span style={{ fontWeight: 600 }}>{t.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderTop: "1px solid var(--line)" }}>
              {isAdmin ? (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
                    <div className="mono-label" style={{ fontSize: 9 }}>Admin</div>
                  </div>
                  <button className="btn btn-sm" onClick={signOut}>Sign out</button>
                </>
              ) : (
                <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => { setMore(false); setShowLogin(true); }}>Admin sign in</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NavItem({ t, active, onClick }: { t: { label: string; icon: IconName }; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 8, border: 0, cursor: "pointer", fontFamily: "var(--body)", fontSize: 14, fontWeight: 600, textAlign: "left", width: "100%", background: active ? "var(--maroon-tint)" : "transparent", color: active ? "var(--fg)" : "var(--fg-dim)", transition: "background .15s, color .15s" }}>
      {active && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 4, background: "var(--maroon-bright)" }} />}
      <Icon name={t.icon} size={18} /> {t.label}
    </button>
  );
}

function TabBtn({ t, active, onClick }: { t: { label: string; icon: IconName }; active: boolean; onClick: () => void }) {
  return (
    <button className="tabbtn" onClick={onClick} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? "var(--maroon-bright)" : "var(--fg-faint)" }}>
      <Icon name={t.icon} size={21} />
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".05em", textTransform: "uppercase" }}>{t.label}</span>
    </button>
  );
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="tq" style={{ minHeight: "100vh", padding: 32 }}>
        <h1 className="display">Setup needed</h1>
        <p style={{ color: "var(--fg-dim)" }}>Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env, then restart the dev server.</p>
      </div>
    );
  }
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

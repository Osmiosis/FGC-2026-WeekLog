import { useState } from "react";
import { isConfigured } from "./supabase";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Login } from "./auth/Login";
import { Dashboard } from "./dashboard/Dashboard";
import { CalendarView } from "./calendar/CalendarView";
import { DeadlinesView } from "./deadlines/DeadlinesView";
import { MembersAdmin } from "./admin/MembersAdmin";
import { TemplatesAdmin } from "./admin/TemplatesAdmin";

type Tab = "dashboard" | "calendar" | "deadlines" | "members" | "templates";

function Shell() {
  const { session, email, isAdmin, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [calendarDayId, setCalendarDayId] = useState<string | null>(null);

  const openDay = (id: string) => {
    setCalendarDayId(id);
    setTab("calendar");
  };
  const go = (t: Tab) => {
    setCalendarDayId(null);
    setTab(t);
  };

  if (loading) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Loading...</p>;
  if (!session) return <Login />;

  return (
    <main
      style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h1 style={{ margin: 0 }}>Team Qatar FGC 2026</h1>
        <div>
          <span>
            {email} ({isAdmin ? "admin" : "member"})
          </span>{" "}
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        <button onClick={() => go("dashboard")} disabled={tab === "dashboard"}>
          Dashboard
        </button>
        <button onClick={() => go("calendar")} disabled={tab === "calendar"}>
          Calendar
        </button>
        <button onClick={() => go("deadlines")} disabled={tab === "deadlines"}>
          Deadlines
        </button>
        {isAdmin && (
          <>
            <button onClick={() => go("members")} disabled={tab === "members"}>
              Members
            </button>
            <button onClick={() => go("templates")} disabled={tab === "templates"}>
              Requirements
            </button>
          </>
        )}
      </nav>

      {tab === "dashboard" && <Dashboard onOpenDay={openDay} onGoToDeadlines={() => go("deadlines")} />}
      {tab === "calendar" && <CalendarView initialOpenDayId={calendarDayId} />}
      {tab === "deadlines" && <DeadlinesView />}
      {tab === "members" && isAdmin && <MembersAdmin />}
      {tab === "templates" && isAdmin && <TemplatesAdmin />}
    </main>
  );
}

export default function App() {
  if (!isConfigured) {
    return (
      <main style={{ fontFamily: "system-ui", padding: 24 }}>
        <h1>Setup needed</h1>
        <p>
          Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to
          frontend/.env, then restart the dev server.
        </p>
      </main>
    );
  }
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

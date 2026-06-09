import { useState } from "react";
import { isConfigured } from "./supabase";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Login } from "./auth/Login";
import { MembersAdmin } from "./admin/MembersAdmin";
import { TemplatesAdmin } from "./admin/TemplatesAdmin";

function Shell() {
  const { session, email, isAdmin, loading, signOut } = useAuth();
  const [tab, setTab] = useState<"members" | "templates">("members");

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

      {isAdmin ? (
        <>
          <nav style={{ display: "flex", gap: 8, margin: "16px 0" }}>
            <button onClick={() => setTab("members")} disabled={tab === "members"}>
              Members
            </button>
            <button onClick={() => setTab("templates")} disabled={tab === "templates"}>
              Requirements
            </button>
          </nav>
          {tab === "members" ? <MembersAdmin /> : <TemplatesAdmin />}
        </>
      ) : (
        <p style={{ marginTop: 24 }}>
          You are signed in. The calendar and dashboard arrive in the next phases.
        </p>
      )}
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

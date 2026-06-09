import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Configured Supabase with an active admin session.
vi.mock("./lib/supabase", () => ({
  isConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { email: "vibha.aarav@gmail.com" },
            access_token: "t",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      }),
      refreshSession: async () => ({ data: { session: { access_token: "t" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
      signInWithOtp: async () => ({ error: null }),
    },
  },
}));

import App from "./App";

describe("App smoke", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("mounts the authed app shell without crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.endsWith("/api/me")) {
          return new Response(JSON.stringify({ email: "vibha.aarav@gmail.com", isAdmin: true }), { status: 200 });
        }
        if (u.includes("/api/dashboard")) {
          return new Response(
            JSON.stringify({
              today: "2026-06-09",
              overall: "green",
              counts: { daysFlagged: 0, deadlinesOverdue: 0, deadlinesDueSoon: 0 },
              needsAttention: [],
              thisWeek: [],
              upcomingDeadlines: [],
            }),
            { status: 200 }
          );
        }
        if (u.includes("/api/drive/status")) {
          return new Response(JSON.stringify({ configured: false }), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      })
    );

    render(<App />);
    // The authed shell renders navigation buttons once /api/me resolves.
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(0));
  });
});

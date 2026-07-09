import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const useSession = vi.fn();
vi.mock("./lib/auth-client", () => ({
  isConfigured: true,
  GOOGLE_CLIENT_ID: "gid",
  getStoredToken: () => "tok",
  clearToken: vi.fn(),
  storeToken: vi.fn(),
  authClient: {
    useSession: () => useSession(),
    signOut: vi.fn().mockResolvedValue({}),
    signIn: { social: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

// Shared by every api() consumer in the tree (AuthProvider's /api/me check,
// Dashboard's useDashboard hook, etc.) — return a shape each caller expects
// so the authed shell can render past "Loading..." without crashing.
const apiImpl = vi.fn((path: string) => {
  if (path === "/api/me") return Promise.resolve({ email: "u@x.com", isAdmin: true });
  if (path === "/api/dashboard") {
    return Promise.resolve({
      today: "2026-07-09",
      overall: "green",
      counts: { daysFlagged: 0, deadlinesOverdue: 0, deadlinesDueSoon: 0 },
      needsAttention: [],
      thisWeek: [],
      upcomingDeadlines: [],
    });
  }
  if (path === "/api/drive/status") return Promise.resolve({ configured: false });
  return Promise.resolve({});
});
vi.mock("./lib/api", () => ({ api: (path: string) => apiImpl(path) }));

import App from "./App";

describe("App auth gating", () => {
  it("shows the login wall when signed out", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    render(<App />);
    expect(screen.getByText(/THE TEAM/i)).toBeTruthy();
  });

  it("renders the authed app shell with admin nav for a signed-in admin session", async () => {
    useSession.mockReturnValue({ data: { user: { email: "u@x.com" } }, isPending: false });
    render(<App />);

    // Regular nav renders for any signed-in session.
    await waitFor(() => expect(screen.getByRole("button", { name: /Dashboard/i })).toBeTruthy());
    // Admin-only nav ("Requirements") renders once /api/me resolves isAdmin: true.
    await waitFor(() => expect(screen.getByRole("button", { name: /Requirements/i })).toBeTruthy());
  });
});

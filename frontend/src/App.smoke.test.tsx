import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getStoredToken = vi.fn();
vi.mock("./lib/auth-client", () => ({
  isConfigured: true,
  GOOGLE_CLIENT_ID: "gid",
  API_BASE: "",
  TOKEN_KEY: "weeklog_bearer",
  getStoredToken: () => getStoredToken(),
  clearToken: vi.fn(),
  storeToken: vi.fn(),
  signInWithGoogleIdToken: vi.fn().mockResolvedValue({ error: null }),
  signOutRequest: vi.fn().mockResolvedValue(undefined),
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
  it("shows the login wall when signed out (no stored token)", async () => {
    getStoredToken.mockReturnValue(null);
    render(<App />);
    // refresh() runs on mount; once it resolves (no token) the wall renders.
    await waitFor(() => expect(screen.getByText(/THE TEAM/i)).toBeTruthy());
  });

  it("renders the authed app shell with admin nav for a signed-in admin session", async () => {
    getStoredToken.mockReturnValue("tok");
    render(<App />);

    // Regular nav renders for any signed-in session.
    await waitFor(() => expect(screen.getByRole("button", { name: /Dashboard/i })).toBeTruthy());
    // Admin-only nav ("Requirements") renders once /api/me resolves isAdmin: true.
    await waitFor(() => expect(screen.getByRole("button", { name: /Requirements/i })).toBeTruthy());
  });
});

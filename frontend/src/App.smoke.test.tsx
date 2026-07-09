import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
vi.mock("./lib/api", () => ({ api: vi.fn().mockResolvedValue({ email: "u@x.com", isAdmin: true }) }));

import App from "./App";

describe("App auth gating", () => {
  it("shows the login wall when signed out", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    render(<App />);
    expect(screen.getByText(/THE TEAM/i)).toBeTruthy();
  });
});

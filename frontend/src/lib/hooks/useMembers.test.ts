import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../supabase", () => ({
  isConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      }),
      refreshSession: async () => ({ data: { session: { access_token: "t" } } }),
    },
  },
}));

import { useMembers } from "./useMembers";

describe("useMembers endpoint contract", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("loads from /api/members", async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      new Response(JSON.stringify([{ id: "m-01", name: "A", committee: null, active: 1 }]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMembers());
    await waitFor(() => expect(result.current.members.length).toBe(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/members");
  });
});

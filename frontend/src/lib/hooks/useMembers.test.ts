import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useMembers } from "./useMembers";

describe("useMembers endpoint contract", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("loads members (with committees) and the committee list", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes("/api/committees")
        ? [{ id: "com-design", name: "Design" }]
        : [{ id: "m-01", name: "A", committees: ["Design", "Outreach"], active: 1 }];
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMembers());
    await waitFor(() => expect(result.current.members.length).toBe(1));
    expect(result.current.members[0].committees).toEqual(["Design", "Outreach"]);
    await waitFor(() => expect(result.current.committees.length).toBe(1));
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/api/members");
    expect(urls).toContain("/api/committees");
  });
});

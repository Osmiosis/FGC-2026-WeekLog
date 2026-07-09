import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { useNotebook } from "./useNotebook";

describe("useNotebook", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("loads the timeline report and posts a refresh request", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/reports")) {
        return new Response(
          JSON.stringify({ timeline: { id: "r1", kind: "timeline", generated_at: "2026-07-07T00:00:00Z", payload: { subsystems: [{ name: "Shooter", entries: [] }], photosByDate: [] } } }),
          { status: 200 }
        );
      }
      if (url.includes("/requests") && init?.method === "POST") return new Response("{}", { status: 200 });
      if (url.includes("/requests")) return new Response("[]", { status: 200 });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNotebook());
    await waitFor(() => expect(result.current.timeline?.subsystems[0].name).toBe("Shooter"));

    await act(async () => { await result.current.requestRefresh("timeline"); });
    const posted = fetchMock.mock.calls.find((c) => String(c[0]).includes("/requests") && (c[1] as RequestInit)?.method === "POST");
    expect(posted).toBeTruthy();
  });
});

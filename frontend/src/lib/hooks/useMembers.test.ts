import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useMembers } from "./useMembers";

// Demo layer: useMembers talks to the in-browser router (no fetch/token).
// We assert the genuine hook contract against the seeded demo data: members
// load with a committees array, and the committee list loads alongside them.
beforeEach(() => localStorage.clear());

describe("useMembers endpoint contract", () => {
  it("loads members (with committees) and the committee list", async () => {
    const { result } = renderHook(() => useMembers());

    await waitFor(() => expect(result.current.members.length).toBeGreaterThan(0));
    // Each member row carries a committees array (multi-committee membership).
    expect(Array.isArray(result.current.members[0].committees)).toBe(true);

    await waitFor(() => expect(result.current.committees.length).toBeGreaterThan(0));
    // At least one seeded member belongs to one or more committees.
    expect(result.current.members.some((mem) => mem.committees.length > 0)).toBe(true);
  });
});

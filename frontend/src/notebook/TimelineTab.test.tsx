import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineTab } from "./TimelineTab";
import type { TimelinePayload } from "@weeklog/types";

const payload: TimelinePayload = {
  subsystems: [
    { name: "Shooter", entries: [{ date: "2026-07-07", kind: "accomplishment", text: "Shooter tuned", created_by: "kid@example.com" }] },
    { name: "Climber", entries: [{ date: "2026-07-08", kind: "failure", text: "Hook slipped", created_by: null }] },
  ],
  photosByDate: [{ date: "2026-07-07", photos: [{ caption: "test rig", kind: "photo" }] }],
};

describe("TimelineTab", () => {
  it("shows the first subsystem, switches on pick, and renders photos by date", () => {
    render(<TimelineTab payload={payload} />);
    expect(screen.getByText("Shooter tuned")).toBeTruthy();
    expect(screen.getByText(/test rig/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Climber/ }));
    expect(screen.getByText("Hook slipped")).toBeTruthy();
  });
});

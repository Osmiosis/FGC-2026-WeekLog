import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionsTab } from "./DecisionsTab";
import type { DecisionPayload } from "@weeklog/types";

const payload: DecisionPayload = {
  decisions: [
    {
      title: "Switched 6-wheel to 4-wheel drivetrain",
      date: "2026-06-17",
      subsystem: "Drivetrain/Collector",
      chosen: "Went with 4-wheel",
      missing: ["why", "numbers"],
      prompt: "Explain why 4-wheel won and the numbers behind it",
    },
  ],
};

describe("DecisionsTab", () => {
  it("renders a decision with chosen, only its missing chips, and the prompt", () => {
    render(<DecisionsTab payload={payload} />);
    expect(screen.getByText("Switched 6-wheel to 4-wheel drivetrain")).toBeTruthy();
    expect(screen.getByText("Went with 4-wheel")).toBeTruthy();
    expect(screen.getByText(/Why/)).toBeTruthy();
    expect(screen.getByText(/Numbers/)).toBeTruthy();
    expect(screen.queryByText(/Alternatives/)).toBeNull(); // not in missing
    expect(screen.getByText(/Explain why 4-wheel won/)).toBeTruthy();
  });

  it("shows the empty state for no decisions", () => {
    render(<DecisionsTab payload={{ decisions: [] }} />);
    expect(screen.getByText(/No decision worksheet yet/)).toBeTruthy();
  });
});

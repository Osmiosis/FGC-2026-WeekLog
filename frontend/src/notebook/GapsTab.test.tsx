import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GapsTab } from "./GapsTab";
import type { GapPayload } from "@weeklog/types";

const payload: GapPayload = {
  criteria: [
    { criterion: "Trade-off analysis", status: "thin", finding: "Only 1 decision documented", suggestions: ["Write up the wheel change", "Add the numbers"] },
    { criterion: "Design iteration photos", status: "missing", finding: "Shooter has builds but no sketches", suggestions: [] },
  ],
};

describe("GapsTab", () => {
  it("renders one card per criterion with finding and suggestions", () => {
    render(<GapsTab payload={payload} />);
    expect(screen.getByText("Trade-off analysis")).toBeTruthy();
    expect(screen.getByText("Only 1 decision documented")).toBeTruthy();
    expect(screen.getByText("Write up the wheel change")).toBeTruthy();
    expect(screen.getByText("Design iteration photos")).toBeTruthy();
  });

  it("renders a strong-status criterion's label and finding", () => {
    const strongPayload: GapPayload = {
      criteria: [
        { criterion: "Attendance logging", status: "strong", finding: "Every meeting has attendance recorded", suggestions: [] },
      ],
    };
    render(<GapsTab payload={strongPayload} />);
    expect(screen.getByText("Attendance logging")).toBeTruthy();
    expect(screen.getByText("Every meeting has attendance recorded")).toBeTruthy();
    expect(screen.getByText("Strong")).toBeTruthy();
  });

  it("shows the empty-state message when criteria is empty", () => {
    const emptyPayload: GapPayload = { criteria: [] };
    render(<GapsTab payload={emptyPayload} />);
    expect(screen.getByText("No criteria in this report.")).toBeTruthy();
  });
});

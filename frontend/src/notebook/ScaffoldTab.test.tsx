import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScaffoldTab } from "./ScaffoldTab";
import type { ScaffoldPayload } from "@weeklog/types";

const payload: ScaffoldPayload = {
  draft_notice: "DRAFT. NOT FOR SUBMISSION.",
  sections: [
    { heading: "Drivetrain", raw_material: ["Went with 4-wheel drivetrain"], needs: ["Why did 4-wheel win?"] },
  ],
};

describe("ScaffoldTab", () => {
  it("renders the draft banner, heading, raw material, and NEEDS slots", () => {
    render(<ScaffoldTab payload={payload} />);
    expect(screen.getByText(/NOT FOR SUBMISSION/)).toBeTruthy();
    expect(screen.getByText("Drivetrain")).toBeTruthy();
    expect(screen.getByText("Went with 4-wheel drivetrain")).toBeTruthy();
    expect(screen.getByText(/Why did 4-wheel win\?/)).toBeTruthy();
  });

  it("copies raw markdown to the clipboard", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ScaffoldTab payload={payload} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy raw markdown/ }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const md = writeText.mock.calls[0][0] as string;
    expect(md).toContain("## Drivetrain");
    expect(md).toContain("- Went with 4-wheel drivetrain");
    expect(md).toContain("[NEEDS: Why did 4-wheel win?]");
  });

  it("shows the empty state for no sections", () => {
    render(<ScaffoldTab payload={{ draft_notice: "x", sections: [] }} />);
    expect(screen.getByText(/No scaffold yet/)).toBeTruthy();
  });
});

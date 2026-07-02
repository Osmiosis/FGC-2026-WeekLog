import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookView } from "./NotebookView";

// DEMO behavior: tabs start locked; a simulated Generate reveals seeded reports.
describe("NotebookView (demo)", () => {
  beforeEach(() => localStorage.clear());

  it("starts locked with generate controls and the sample-data explainer", () => {
    render(<NotebookView />);
    expect(screen.getByText(/Not a notebook/)).toBeTruthy();
    expect(screen.getByText(/not a live AI call/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Timeline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate reasoning reports" })).toBeTruthy();
    // Timeline is the default tab and starts locked.
    expect(screen.getByText(/^Locked\./)).toBeTruthy();
  });

  it("shows an honest simulating label when a generate is clicked", () => {
    render(<NotebookView />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Timeline" }));
    expect(screen.getByText(/not a real AI call/)).toBeTruthy();
  });
});

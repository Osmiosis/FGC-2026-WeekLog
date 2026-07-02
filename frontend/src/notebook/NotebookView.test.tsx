import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ isAdmin: false, email: null }) }));
vi.mock("../lib/hooks/useNotebook", () => ({
  useNotebook: () => ({
    timeline: null,
    reports: {},
    pending: [],
    error: null,
    busy: false,
    generateTimeline: vi.fn(),
    requestRefresh: vi.fn(),
  }),
}));

import { NotebookView } from "./NotebookView";

describe("NotebookView", () => {
  it("shows the banner and an enabled, switchable Gaps tab", () => {
    render(<NotebookView />);
    expect(screen.getByText(/The team writes the notebook/)).toBeTruthy();
    const gaps = screen.getByRole("button", { name: "Gaps" }) as HTMLButtonElement;
    expect(gaps.disabled).toBe(false);
    fireEvent.click(gaps);
    expect(screen.getByText(/No gap analysis yet/)).toBeTruthy();
  });

  it("has all four tabs enabled and none disabled", () => {
    render(<NotebookView />);
    for (const name of ["Timeline", "Gaps", "Decisions", "Scaffold"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("switches to Scaffold and shows its empty state", () => {
    render(<NotebookView />);
    fireEvent.click(screen.getByRole("button", { name: "Scaffold" }));
    expect(screen.getByText(/No scaffold yet/)).toBeTruthy();
  });
});

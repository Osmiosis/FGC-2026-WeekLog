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

  it("keeps Decisions disabled (still coming soon)", () => {
    render(<NotebookView />);
    expect((screen.getByRole("button", { name: "Decisions" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

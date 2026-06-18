import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ModeToggle from "../components/ModeToggle";

describe("ModeToggle", () => {
  test("renders ask mode label", () => {
    render(<ModeToggle mode="ask" disabled={false} onSetMode={vi.fn()} />);
    expect(screen.getByText("Ask")).toBeInTheDocument();
  });

  test("renders auto mode label", () => {
    render(<ModeToggle mode="auto" disabled={false} onSetMode={vi.fn()} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });

  test("renders custom mode label", () => {
    render(<ModeToggle mode="custom" hasCustomPermissions disabled={false} onSetMode={vi.fn()} />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});

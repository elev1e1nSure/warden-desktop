import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ModeToggle from "../components/ModeToggle";

describe("ModeToggle", () => {
  test("renders current mode label", () => {
    render(<ModeToggle auto={false} disabled={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Ask")).toBeInTheDocument();
  });

  test("renders auto mode label", () => {
    render(<ModeToggle auto={true} disabled={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });
});

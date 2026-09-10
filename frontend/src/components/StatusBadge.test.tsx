import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, loanDetailStatus } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the Vietnamese label for each status", () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText("Hoạt động")).toBeInTheDocument();
  });

  it("hides its icon from the accessibility tree (icon is decorative next to the label text)", () => {
    render(<StatusBadge status="locked" />);
    const icon = document.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});

describe("loanDetailStatus", () => {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  it("returns borrowing-overdue when still borrowing past the due date", () => {
    expect(loanDetailStatus("borrowing", iso(yesterday))).toBe("borrowing-overdue");
  });

  it("returns borrowing when still within the due date", () => {
    expect(loanDetailStatus("borrowing", iso(tomorrow))).toBe("borrowing");
  });

  it("passes through non-borrowing statuses unchanged even if the due date is past", () => {
    expect(loanDetailStatus("returned", iso(yesterday))).toBe("returned");
  });
});

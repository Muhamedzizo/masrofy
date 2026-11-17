import { describe, expect, it } from "vitest";
import { getMonthlySourceReport } from "../lib/monthly-report";
import type { Expense } from "../lib/expense-db";

const row = (
  id: string,
  source: string,
  amountPiasters: number,
  occurredAt: number,
  status: Expense["status"] = "confirmed",
): Expense => ({
  id,
  source,
  amountPiasters,
  occurredAt,
  description: "",
  categoryId: "other",
  status,
  origin: "manual",
});

describe("monthly payment reports", () => {
  it("groups confirmed spending by payment source and excludes pending and adjacent months", () => {
    const month = new Date(2026, 10, 15);
    const report = getMonthlySourceReport(
      [
        row("start", "fawry", 1000, new Date(2026, 10, 1).getTime()),
        row("middle", "fawry", 500, new Date(2026, 10, 15).getTime()),
        row("cash", "cash", 1500, new Date(2026, 10, 28).getTime()),
        row("pending", "cash", 8000, new Date(2026, 10, 29).getTime(), "pending"),
        row("next-month", "cash", 9000, new Date(2026, 11, 1).getTime()),
      ],
      month,
    );
    expect(report.totalPiasters).toBe(3000);
    expect(report.expenseCount).toBe(3);
    expect(report.rows).toEqual([
      { source: "cash", amountPiasters: 1500, count: 1, percent: 50 },
      { source: "fawry", amountPiasters: 1500, count: 2, percent: 50 },
    ]);
  });

  it("returns a stable empty report when the month has no confirmed expenses", () => {
    const report = getMonthlySourceReport(
      [row("pending", "cash", 500, new Date(2026, 10, 10).getTime(), "pending")],
      new Date(2026, 10, 20),
    );
    expect(report.totalPiasters).toBe(0);
    expect(report.expenseCount).toBe(0);
    expect(report.rows).toEqual([]);
  });
});

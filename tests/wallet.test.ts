import { describe, expect, it } from "vitest";
import {
  calculateWalletBalances,
  getDueSalaryCredits,
  getFirstSalaryDueAt,
  type BalanceEvent,
  type SalaryRule,
} from "../lib/wallet-model";
import type { Expense } from "../lib/expense-db";

const expense = (
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

describe("wallet balance model", () => {
  it("starts from the latest opening balance and subtracts only confirmed expenses after it", () => {
    const openingAt = new Date(2026, 10, 17, 12).getTime();
    const events: BalanceEvent[] = [
      {
        id: "opening:fawry",
        type: "opening",
        amountPiasters: 2000,
        occurredAt: openingAt,
        source: "fawry",
        description: "الرصيد الحالي",
      },
      {
        id: "topup:cash",
        type: "topup",
        amountPiasters: 500,
        occurredAt: openingAt + 1000,
        source: "cash",
        description: "إضافة نقدية",
      },
    ];
    const expenses = [
      expense("old", "fawry", 9000, openingAt - 1000),
      expense("spent", "fawry", 1000, openingAt + 2000),
      expense("pending", "fawry", 400, openingAt + 3000, "pending"),
      expense("cash-spent", "cash", 300, openingAt + 4000),
    ];
    const balances = calculateWalletBalances(
      ["fawry", "cash", "instapay"],
      events,
      expenses,
      openingAt + 5000,
    );
    expect(balances.find((item) => item.source === "fawry")?.balancePiasters).toBe(1000);
    expect(balances.find((item) => item.source === "cash")?.balancePiasters).toBe(200);
    expect(balances.find((item) => item.source === "instapay")?.isTracked).toBe(false);
  });

  it("creates one deterministic credit per due salary month and clamps day 31 in short months", () => {
    const firstDueAt = new Date(2026, 0, 31, 9).getTime();
    const rule: SalaryRule = {
      id: "salary-main",
      label: "المرتب",
      amountPiasters: 2500000,
      source: "fawry",
      dayOfMonth: 31,
      firstDueAt,
      enabled: true,
    };
    const due = getDueSalaryCredits(rule, new Date(2026, 2, 31, 10).getTime());
    expect(due.map((item) => item.occurredAt)).toEqual([
      new Date(2026, 0, 31, 9).getTime(),
      new Date(2026, 1, 28, 9).getTime(),
      new Date(2026, 2, 31, 9).getTime(),
    ]);
    expect(new Set(due.map((item) => item.recurringKey)).size).toBe(3);
    expect(getDueSalaryCredits({ ...rule, enabled: false }, Date.now())).toEqual([]);
  });

  it("schedules salary for this month if the payday remains, otherwise next month", () => {
    expect(getFirstSalaryDueAt(20, new Date(2026, 10, 17, 12))).toBe(
      new Date(2026, 10, 20, 9).getTime(),
    );
    expect(getFirstSalaryDueAt(10, new Date(2026, 10, 17, 12))).toBe(
      new Date(2026, 11, 10, 9).getTime(),
    );
  });
});

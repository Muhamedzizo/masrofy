import type { Expense } from "@/lib/expense-db";

export type MonthlyPaymentRow = {
  source: string;
  amountPiasters: number;
  count: number;
  percent: number;
};

export type MonthlySourceReport = {
  startAt: number;
  endAt: number;
  totalPiasters: number;
  expenseCount: number;
  rows: MonthlyPaymentRow[];
};

export function getMonthStart(date: Date, offset = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function getMonthlySourceReport(
  expenses: Expense[],
  month: Date,
): MonthlySourceReport {
  const startAt = getMonthStart(month).getTime();
  const endAt = getMonthStart(month, 1).getTime();
  const rows = new Map<string, { amountPiasters: number; count: number }>();
  for (const expense of expenses) {
    if (
      expense.status !== "confirmed" ||
      expense.occurredAt < startAt ||
      expense.occurredAt >= endAt
    ) continue;
    const current = rows.get(expense.source) ?? { amountPiasters: 0, count: 0 };
    current.amountPiasters += expense.amountPiasters;
    current.count += 1;
    rows.set(expense.source, current);
  }
  const totalPiasters = [...rows.values()].reduce(
    (sum, row) => sum + row.amountPiasters,
    0,
  );
  const reportRows = [...rows.entries()]
    .map(([source, row]) => ({
      source,
      ...row,
      percent: totalPiasters ? Math.round((row.amountPiasters / totalPiasters) * 100) : 0,
    }))
    .sort(
      (a, b) =>
        b.amountPiasters - a.amountPiasters ||
        a.source.localeCompare(b.source, "en"),
    );
  return {
    startAt,
    endAt,
    totalPiasters,
    expenseCount: reportRows.reduce((sum, row) => sum + row.count, 0),
    rows: reportRows,
  };
}

import type { Expense } from "@/lib/expense-db";

export type BalanceEventType = "opening" | "topup" | "salary";
export type BalanceEvent = {
  id: string;
  type: BalanceEventType;
  amountPiasters: number;
  occurredAt: number;
  source: string;
  description: string;
  recurringKey?: string;
};

export type SalaryRule = {
  id: string;
  label: string;
  amountPiasters: number;
  source: string;
  dayOfMonth: number;
  firstDueAt: number;
  enabled: boolean;
};

export type WalletBalance = {
  source: string;
  balancePiasters: number;
  isTracked: boolean;
};

/**
 * An opening balance is a point-in-time snapshot. Expenses before that snapshot
 * must not be subtracted again. Without an opening balance, tracking starts at
 * the first recorded top-up/salary. Pending expenses never affect available cash.
 */
export function calculateWalletBalances(
  sources: string[],
  events: BalanceEvent[],
  expenses: Expense[],
  asOf = Date.now(),
): WalletBalance[] {
  const allSources = new Set([
    ...sources,
    ...events.map((event) => event.source),
    ...expenses.map((expense) => expense.source),
  ]);

  return [...allSources].map((source) => {
    const sourceEvents = events.filter(
      (event) => event.source === source && event.occurredAt <= asOf,
    );
    const opening = sourceEvents
      .filter((event) => event.type === "opening")
      .sort((a, b) => b.occurredAt - a.occurredAt)[0];
    const credits = sourceEvents.filter((event) => event.type !== "opening");
    const firstCredit = credits.reduce<number | null>(
      (earliest, event) =>
        earliest === null || event.occurredAt < earliest
          ? event.occurredAt
          : earliest,
      null,
    );
    const startAt = opening?.occurredAt ?? firstCredit;
    const tracked = startAt !== null;
    if (!tracked) return { source, balancePiasters: 0, isTracked: false };

    const initial = opening?.amountPiasters ?? 0;
    const credited = credits
      .filter((event) => event.occurredAt >= startAt!)
      .reduce((sum, event) => sum + event.amountPiasters, 0);
    const spent = expenses
      .filter(
        (expense) =>
          expense.status === "confirmed" &&
          expense.source === source &&
          expense.occurredAt >= startAt! &&
          expense.occurredAt <= asOf,
      )
      .reduce((sum, expense) => sum + expense.amountPiasters, 0);

    return {
      source,
      balancePiasters: initial + credited - spent,
      isTracked: true,
    };
  });
}

const pad2 = (value: number) => String(value).padStart(2, "0");

function salaryOccurrence(rule: SalaryRule, year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const first = new Date(rule.firstDueAt);
  return new Date(
    year,
    month,
    Math.min(rule.dayOfMonth, lastDay),
    first.getHours(),
    first.getMinutes(),
    first.getSeconds(),
    first.getMilliseconds(),
  ).getTime();
}

/** Return due salary credits through `asOf`, including missed months, once per rule-month. */
export function getDueSalaryCredits(rule: SalaryRule, asOf = Date.now()) {
  if (!rule.enabled || rule.amountPiasters <= 0) return [];
  const firstDate = new Date(rule.firstDueAt);
  if (!Number.isFinite(firstDate.getTime())) return [];
  const result: Array<{
    id: string;
    type: "salary";
    amountPiasters: number;
    occurredAt: number;
    source: string;
    description: string;
    recurringKey: string;
  }> = [];
  let year = firstDate.getFullYear();
  let month = firstDate.getMonth();

  for (let count = 0; count < 1200; count += 1) {
    const occurredAt = salaryOccurrence(rule, year, month);
    if (occurredAt > asOf) break;
    if (occurredAt >= rule.firstDueAt) {
      const monthKey = `${year}-${pad2(month + 1)}`;
      const recurringKey = `salary:${rule.id}:${monthKey}`;
      result.push({
        id: recurringKey,
        type: "salary",
        amountPiasters: rule.amountPiasters,
        occurredAt,
        source: rule.source,
        description: rule.label,
        recurringKey,
      });
    }
    month += 1;
    if (month > 11) {
      year += 1;
      month = 0;
    }
  }
  return result;
}

/** First due date is this month if the selected day has not passed, otherwise next month. */
export function getFirstSalaryDueAt(dayOfMonth: number, now = new Date()) {
  const day = Math.max(1, Math.min(31, Math.trunc(dayOfMonth)));
  let year = now.getFullYear();
  let month = now.getMonth();
  if (day < now.getDate()) {
    month += 1;
    if (month > 11) {
      year += 1;
      month = 0;
    }
  }
  return salaryOccurrence(
    {
      id: "new",
      label: "",
      amountPiasters: 1,
      source: "",
      dayOfMonth: day,
      firstDueAt: new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 9).getTime(),
      enabled: true,
    },
    year,
    month,
  );
}

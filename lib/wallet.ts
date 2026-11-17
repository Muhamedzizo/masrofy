import {
  listBalanceEvents,
  listExpenses,
  listSalaryRules,
  saveBalanceEvent,
  saveSalaryRule,
} from "@/lib/expense-db";
import {
  calculateWalletBalances,
  getDueSalaryCredits,
  getFirstSalaryDueAt,
} from "@/lib/wallet-model";
import type { BalanceEvent, SalaryRule } from "@/lib/wallet-model";

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function addOpeningBalance(
  source: string,
  amountPiasters: number,
  occurredAt = Date.now(),
) {
  if (!source || !Number.isSafeInteger(amountPiasters) || amountPiasters < 0) {
    throw new Error("تحقق من وسيلة الدفع والمبلغ.");
  }
  const event: BalanceEvent = {
    id: `opening:${encodeURIComponent(source)}`,
    type: "opening",
    amountPiasters,
    occurredAt,
    source,
    description: "الرصيد الحالي",
  };
  await saveBalanceEvent(event);
}

export async function addTopUp(
  source: string,
  amountPiasters: number,
  description = "إضافة رصيد",
  occurredAt = Date.now(),
) {
  if (!source || !Number.isSafeInteger(amountPiasters) || amountPiasters <= 0) {
    throw new Error("تحقق من وسيلة الدفع والمبلغ.");
  }
  await saveBalanceEvent({
    id: makeId("topup"),
    type: "topup",
    amountPiasters,
    occurredAt,
    source,
    description: description.trim().slice(0, 80) || "إضافة رصيد",
  });
}

export async function createMonthlySalary(input: {
  label: string;
  amountPiasters: number;
  source: string;
  dayOfMonth: number;
  now?: Date;
}): Promise<SalaryRule> {
  const label = input.label.replace(/\s+/g, " ").trim().slice(0, 40) || "المرتب الشهري";
  if (
    !input.source ||
    !Number.isSafeInteger(input.amountPiasters) ||
    input.amountPiasters <= 0 ||
    !Number.isInteger(input.dayOfMonth) ||
    input.dayOfMonth < 1 ||
    input.dayOfMonth > 31
  ) {
    throw new Error("تحقق من مبلغ المرتب وطريقة الدفع ويوم الإضافة.");
  }
  const now = input.now ?? new Date();
  const rule: SalaryRule = {
    id: makeId("salary"),
    label,
    amountPiasters: input.amountPiasters,
    source: input.source,
    dayOfMonth: input.dayOfMonth,
    firstDueAt: getFirstSalaryDueAt(input.dayOfMonth, now),
    enabled: true,
  };
  await saveSalaryRule(rule);
  await accrueDueSalaries(now.getTime());
  return rule;
}

/**
 * Credits every elapsed due month, including months while the app was closed.
 * A unique rule+month key in the local database prevents duplicate salary entries.
 */
export async function accrueDueSalaries(asOf = Date.now()) {
  const rules = await listSalaryRules();
  for (const rule of rules) {
    for (const credit of getDueSalaryCredits(rule, asOf)) {
      await saveBalanceEvent(credit);
    }
  }
}

export async function getWalletSnapshot(sources: string[], asOf = Date.now()) {
  await accrueDueSalaries(asOf);
  const [events, expenses] = await Promise.all([
    listBalanceEvents(),
    listExpenses(),
  ]);
  return {
    events,
    expenses,
    balances: calculateWalletBalances(sources, events, expenses, asOf),
  };
}

export function createSalaryRuleId() {
  return makeId("salary");
}

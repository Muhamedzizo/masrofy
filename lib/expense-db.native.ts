import * as SQLite from "expo-sqlite";
import type { BalanceEvent, SalaryRule } from "@/lib/wallet-model";

export type PaymentSource = string;
export type ExpenseStatus = "pending" | "confirmed";
export type ExpenseOrigin = "manual" | "notification";

export type Expense = {
  id: string;
  amountPiasters: number;
  occurredAt: number;
  source: PaymentSource;
  description: string;
  categoryId: string;
  status: ExpenseStatus;
  origin: ExpenseOrigin;
  sourceEventId?: string;
};

export type NotificationCandidate = {
  id: string;
  source: string;
  amountPiasters: number;
  timestamp: number;
  description?: string;
};

const DATABASE_NAME = "masrofy.db";
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

function makeId(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function candidateDescription(value?: string): string {
  const normalized = (value ?? "")
    .replace(/[\u0000-\u001f\u007f\u200e-\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized && normalized.length <= 48 && !/\d/.test(normalized)
    ? normalized
    : "عملية من إشعار";
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = await getDatabase();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        amountPiasters INTEGER NOT NULL,
        occurredAt INTEGER NOT NULL,
        source TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        categoryId TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT NOT NULL,
        sourceEventId TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS expenses_status_time ON expenses(status, occurredAt DESC);
      CREATE TABLE IF NOT EXISTS balance_events (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        amountPiasters INTEGER NOT NULL,
        occurredAt INTEGER NOT NULL,
        source TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        recurringKey TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS balance_events_source_time ON balance_events(source, occurredAt DESC);
      CREATE TABLE IF NOT EXISTS salary_rules (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        amountPiasters INTEGER NOT NULL,
        source TEXT NOT NULL,
        dayOfMonth INTEGER NOT NULL,
        firstDueAt INTEGER NOT NULL,
        enabled INTEGER NOT NULL
      );
      `);
  })().catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

export async function listExpenses(status?: ExpenseStatus): Promise<Expense[]> {
  await initDatabase();
  const db = await getDatabase();
  return status
    ? db.getAllAsync<Expense>(
        "SELECT id, amountPiasters, occurredAt, source, description, categoryId, status, origin, sourceEventId FROM expenses WHERE status = ? ORDER BY occurredAt DESC",
        status,
      )
    : db.getAllAsync<Expense>(
        "SELECT id, amountPiasters, occurredAt, source, description, categoryId, status, origin, sourceEventId FROM expenses ORDER BY occurredAt DESC",
      );
}

export async function saveExpense(expense: Expense): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO expenses (id, amountPiasters, occurredAt, source, description, categoryId, status, origin, sourceEventId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET amountPiasters=excluded.amountPiasters, occurredAt=excluded.occurredAt, source=excluded.source, description=excluded.description, categoryId=excluded.categoryId, status=excluded.status, origin=excluded.origin, sourceEventId=excluded.sourceEventId`,
    expense.id,
    expense.amountPiasters,
    expense.occurredAt,
    expense.source,
    expense.description,
    expense.categoryId,
    expense.status,
    expense.origin,
    expense.sourceEventId ?? null,
  );
}

export async function deleteExpense(id: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync("DELETE FROM expenses WHERE id = ?", id);
}

export async function listBalanceEvents(): Promise<BalanceEvent[]> {
  await initDatabase();
  const db = await getDatabase();
  return db.getAllAsync<BalanceEvent>(
    "SELECT id, type, amountPiasters, occurredAt, source, description, recurringKey FROM balance_events ORDER BY occurredAt DESC",
  );
}

export async function saveBalanceEvent(event: BalanceEvent): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO balance_events (id, type, amountPiasters, occurredAt, source, description, recurringKey)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET type=excluded.type, amountPiasters=excluded.amountPiasters, occurredAt=excluded.occurredAt, source=excluded.source, description=excluded.description, recurringKey=excluded.recurringKey`,
    event.id,
    event.type,
    event.amountPiasters,
    event.occurredAt,
    event.source,
    event.description,
    event.recurringKey ?? null,
  );
}

type SalaryRuleRow = Omit<SalaryRule, "enabled"> & { enabled: number };

export async function listSalaryRules(): Promise<SalaryRule[]> {
  await initDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<SalaryRuleRow>(
    "SELECT id, label, amountPiasters, source, dayOfMonth, firstDueAt, enabled FROM salary_rules ORDER BY firstDueAt DESC",
  );
  return rows.map((row) => ({ ...row, enabled: row.enabled !== 0 }));
}

export async function saveSalaryRule(rule: SalaryRule): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO salary_rules (id, label, amountPiasters, source, dayOfMonth, firstDueAt, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label=excluded.label, amountPiasters=excluded.amountPiasters, source=excluded.source, dayOfMonth=excluded.dayOfMonth, firstDueAt=excluded.firstDueAt, enabled=excluded.enabled`,
    rule.id,
    rule.label,
    rule.amountPiasters,
    rule.source,
    rule.dayOfMonth,
    rule.firstDueAt,
    rule.enabled ? 1 : 0,
  );
}

export async function deleteSalaryRule(id: string): Promise<void> {
  await initDatabase();
  const db = await getDatabase();
  await db.runAsync("DELETE FROM salary_rules WHERE id = ?", id);
}

export async function ingestCandidates(
  candidates: NotificationCandidate[],
): Promise<void> {
  if (!candidates.length) return;
  await initDatabase();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const candidate of candidates) {
      await db.runAsync(
        "INSERT OR IGNORE INTO expenses (id, amountPiasters, occurredAt, source, description, categoryId, status, origin, sourceEventId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `notification_${candidate.id}`,
        candidate.amountPiasters,
        candidate.timestamp,
        candidate.source,
        candidateDescription(candidate.description),
        "other",
        "pending",
        "notification",
        candidate.id,
      );
    }
  });
}

export function createExpenseId(): string {
  return makeId();
}

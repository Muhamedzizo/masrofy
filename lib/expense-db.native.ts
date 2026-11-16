import * as SQLite from "expo-sqlite";

export type PaymentSource = "instapay" | "vodafone" | "fawry" | "manual";
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
  source: "instapay" | "vodafone" | "fawry";
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

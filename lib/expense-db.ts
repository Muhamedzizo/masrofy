import AsyncStorage from "@react-native-async-storage/async-storage";

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

const STORAGE_KEY = "masrofy.expenses.v1";
let initPromise: Promise<void> | null = null;
let webQueue: Promise<void> = Promise.resolve();

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

function samplePreviewExpenses(): Expense[] {
  const now = Date.now();
  return [
    {
      id: "preview-market",
      amountPiasters: 18450,
      occurredAt: now - 2 * 60 * 60 * 1000,
      source: "manual",
      description: "مشتريات البيت",
      categoryId: "shopping",
      status: "confirmed",
      origin: "manual",
    },
    {
      id: "preview-lunch",
      amountPiasters: 9200,
      occurredAt: now - 26 * 60 * 60 * 1000,
      source: "vodafone",
      description: "غداء",
      categoryId: "food",
      status: "confirmed",
      origin: "manual",
    },
    {
      id: "preview-ride",
      amountPiasters: 6500,
      occurredAt: now - 50 * 60 * 60 * 1000,
      source: "instapay",
      description: "مشوار",
      categoryId: "transport",
      status: "confirmed",
      origin: "manual",
    },
    {
      id: "preview-pending",
      amountPiasters: 15750,
      occurredAt: now - 90 * 60 * 1000,
      source: "fawry",
      description: "عملية تحتاج مراجعة",
      categoryId: "other",
      status: "pending",
      origin: "notification",
      sourceEventId: "preview-event",
    },
  ];
}

async function readExpenses(): Promise<Expense[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as Expense[]) : [];
    } catch {
      return [];
    }
  }
  const seed = samplePreviewExpenses();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

async function writeExpenses(expenses: Expense[]): Promise<void> {
  webQueue = webQueue.then(() =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)),
  );
  await webQueue;
}

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = readExpenses()
    .then(() => undefined)
    .catch((error) => {
      initPromise = null;
      throw error;
    });
  return initPromise;
}

export async function listExpenses(status?: ExpenseStatus): Promise<Expense[]> {
  await initDatabase();
  return (await readExpenses())
    .filter((expense) => !status || expense.status === status)
    .sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function saveExpense(expense: Expense): Promise<void> {
  await initDatabase();
  const expenses = await readExpenses();
  const next = expenses.filter(
    (item) =>
      item.id !== expense.id &&
      (!expense.sourceEventId || item.sourceEventId !== expense.sourceEventId),
  );
  next.push(expense);
  await writeExpenses(next);
}

export async function deleteExpense(id: string): Promise<void> {
  await initDatabase();
  await writeExpenses((await readExpenses()).filter((expense) => expense.id !== id));
}

export async function ingestCandidates(
  candidates: NotificationCandidate[],
): Promise<void> {
  if (!candidates.length) return;
  await initDatabase();
  const existing = await readExpenses();
  const eventIds = new Set(
    existing.map((expense) => expense.sourceEventId).filter(Boolean),
  );
  const ids = new Set(existing.map((expense) => expense.id));
  const additions: Expense[] = candidates
    .map((candidate): Expense => ({
      id: `notification_${candidate.id}`,
      amountPiasters: candidate.amountPiasters,
      occurredAt: candidate.timestamp,
      source: candidate.source,
      description: candidateDescription(candidate.description),
      categoryId: "other",
      status: "pending",
      origin: "notification",
      sourceEventId: candidate.id,
    }))
    .filter(
      (expense) => !eventIds.has(expense.sourceEventId) && !ids.has(expense.id),
    );
  if (additions.length) await writeExpenses([...existing, ...additions]);
}

export function createExpenseId(): string {
  return makeId();
}

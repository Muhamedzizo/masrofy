import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import type { ExpenseCategory } from "@/lib/categories";

export type PaymentMethod = { id: string; label: string; custom?: boolean };

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "cash", label: "كاش" },
  { id: "manual", label: "يدوي" },
  { id: "instapay", label: "إنستا باي" },
  { id: "vodafone", label: "فودافون كاش" },
  { id: "fawry", label: "myFawry" },
];

const CATEGORIES_KEY = "masrofy.custom-categories.v1";
const PAYMENT_METHODS_KEY = "masrofy.custom-payment-methods.v1";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseRows<T extends { id: string; label: string }>(
  json: string | null,
): T[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is T =>
        !!item &&
        typeof item === "object" &&
        typeof (item as T).id === "string" &&
        typeof (item as T).label === "string" &&
        (item as T).label.trim().length > 0 &&
        (item as T).label.length <= 40,
    );
  } catch {
    return [];
  }
}

export async function loadExpenseCategories(): Promise<ExpenseCategory[]> {
  const custom = parseRows<ExpenseCategory>(await AsyncStorage.getItem(CATEGORIES_KEY));
  const ids = new Set(DEFAULT_CATEGORIES.map((item) => item.id));
  return [
    ...DEFAULT_CATEGORIES,
    ...custom.filter((item) => !ids.has(item.id)),
  ];
}

export async function addExpenseCategory(label: string): Promise<ExpenseCategory[]> {
  const clean = label.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 40) throw new Error("اكتب اسم فئة من 1 إلى 40 حرفًا.");
  const existing = await loadExpenseCategories();
  if (existing.some((item) => item.label.localeCompare(clean, "ar", { sensitivity: "base" }) === 0)) {
    throw new Error("الفئة موجودة بالفعل.");
  }
  const custom = parseRows<ExpenseCategory>(await AsyncStorage.getItem(CATEGORIES_KEY));
  custom.push({
    id: makeId("category"),
    label: clean,
    icon: "pricetag-outline",
    color: "#66736E",
    tint: "#E9EEEB",
  });
  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(custom));
  return loadExpenseCategories();
}

export async function loadPaymentMethods(): Promise<PaymentMethod[]> {
  const custom = parseRows<PaymentMethod>(await AsyncStorage.getItem(PAYMENT_METHODS_KEY));
  const ids = new Set(DEFAULT_PAYMENT_METHODS.map((item) => item.id));
  return [
    ...DEFAULT_PAYMENT_METHODS,
    ...custom.filter((item) => !ids.has(item.id)),
  ];
}

export async function addPaymentMethod(
  label: string,
  requestedId?: string,
): Promise<PaymentMethod[]> {
  const clean = label.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 40) throw new Error("اكتب اسم طريقة دفع من 1 إلى 40 حرفًا.");
  const current = await loadPaymentMethods();
  const sameLabel = current.find(
    (item) => item.label.localeCompare(clean, "ar", { sensitivity: "base" }) === 0,
  );
  if (sameLabel?.id === requestedId) return current;
  if (sameLabel && !requestedId) throw new Error("طريقة الدفع بهذا الاسم موجودة بالفعل.");
  const custom = parseRows<PaymentMethod>(await AsyncStorage.getItem(PAYMENT_METHODS_KEY));
  const id = requestedId ?? makeId("payment");
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id)) throw new Error("معرّف طريقة الدفع غير صالح.");
  const existing = custom.find((item) => item.id === id);
  if (existing) {
    existing.label = clean;
  } else {
    custom.push({ id, label: clean, custom: true });
  }
  await AsyncStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(custom));
  return loadPaymentMethods();
}

export function getPaymentMethodLabel(
  source: string,
  methods: PaymentMethod[] = DEFAULT_PAYMENT_METHODS,
): string {
  return methods.find((item) => item.id === source)?.label ?? source;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export type ExpensePeriod = "month" | "previousMonth" | "last30Days" | "all";

export const EXPENSE_PERIODS: ReadonlyArray<{
  id: ExpensePeriod;
  label: string;
}> = [
  { id: "month", label: "الشهر الحالي" },
  { id: "previousMonth", label: "الشهر السابق" },
  { id: "last30Days", label: "آخر 30 يوم" },
  { id: "all", label: "كل الوقت" },
];

function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}

export function parseAmountToPiasters(input: string): number | null {
  const normalized = toLatinDigits(input)
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  if (!normalized || !/^-?\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function formatPiasters(
  amountPiasters: number,
  options: { currency?: boolean; decimals?: boolean } = {},
): string {
  const amount = amountPiasters / 100;
  const formatted = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: options.decimals === false ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return options.currency === false ? formatted : `${formatted} ج.م`;
}

export function formatDate(timestamp: number, includeTime = false): string {
  const date = new Date(timestamp);
  const dateText = new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
  }).format(date);
  if (!includeTime) return dateText;
  return `${dateText} · ${new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(date)}`;
}

export function currentMonthRange(now = new Date()): {
  start: number;
  end: number;
} {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
  };
}

export function getExpensePeriodRange(
  period: ExpensePeriod,
  now = new Date(),
): { start: number; end: number } {
  if (period === "month") return currentMonthRange(now);
  if (period === "previousMonth") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    };
  }
  if (period === "last30Days") {
    return {
      start: now.getTime() - 30 * 24 * 60 * 60 * 1000,
      end: now.getTime() + 1,
    };
  }
  return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
}

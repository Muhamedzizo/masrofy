import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, getCategory } from "../lib/categories";
import {
  currentMonthRange,
  EXPENSE_PERIODS,
  formatPiasters,
  getExpensePeriodRange,
  parseAmountToPiasters,
} from "../lib/money";

describe("money helpers", () => {
  it("parses decimal pounds into integer piasters", () => {
    expect(parseAmountToPiasters("12.35")).toBe(1235);
    expect(parseAmountToPiasters("1,234.50")).toBe(123450);
  });

  it("accepts Arabic digits and rejects invalid amounts", () => {
    expect(parseAmountToPiasters("١٢٫٥٠")).toBe(1250);
    expect(parseAmountToPiasters("0")).toBeNull();
    expect(parseAmountToPiasters("12.999")).toBeNull();
  });

  it("formats amounts without losing fractional piasters", () => {
    expect(formatPiasters(12345, { currency: false })).toContain("١٢٣٫٤٥");
    expect(formatPiasters(12345)).toContain("ج.م");
  });
});

describe("expense periods", () => {
  const now = new Date(2026, 10, 16, 12, 30, 0, 0);

  it("offers the four supported reporting periods", () => {
    expect(EXPENSE_PERIODS.map((period) => period.id)).toEqual([
      "month",
      "previousMonth",
      "last30Days",
      "all",
    ]);
  });

  it("uses local calendar-month boundaries for current and previous month", () => {
    expect(currentMonthRange(now)).toEqual({
      start: new Date(2026, 10, 1).getTime(),
      end: new Date(2026, 11, 1).getTime(),
    });
    expect(getExpensePeriodRange("previousMonth", now)).toEqual({
      start: new Date(2026, 9, 1).getTime(),
      end: new Date(2026, 10, 1).getTime(),
    });
  });

  it("uses a rolling 30-day window ending at the selected moment", () => {
    expect(getExpensePeriodRange("last30Days", now)).toEqual({
      start: now.getTime() - 30 * 24 * 60 * 60 * 1000,
      end: now.getTime() + 1,
    });
  });

  it("keeps all historical transactions in the all-time period", () => {
    expect(getExpensePeriodRange("all", now)).toEqual({
      start: Number.NEGATIVE_INFINITY,
      end: Number.POSITIVE_INFINITY,
    });
  });
});

describe("expense categories", () => {
  it("includes the six expected Arabic default categories", () => {
    expect(DEFAULT_CATEGORIES.map((category) => category.label)).toEqual([
      "طعام",
      "مواصلات",
      "فواتير",
      "تسوق",
      "صحة",
      "أخرى",
    ]);
  });

  it("falls back to the other category for unknown identifiers", () => {
    expect(getCategory("unknown").id).toBe("other");
  });
});

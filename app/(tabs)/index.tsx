import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { DEFAULT_CATEGORIES, getCategory } from "@/lib/categories";
import { initDatabase, listExpenses } from "@/lib/expense-db";
import type { Expense, PaymentSource } from "@/lib/expense-db";
import {
  EXPENSE_PERIODS,
  formatDate,
  formatPiasters,
  getExpensePeriodRange,
} from "@/lib/money";
import type { ExpensePeriod } from "@/lib/money";

const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  coral: "#C65F47",
  amber: "#D5A13D",
  white: "#FFFFFF",
  mint: "#E6F1EE",
};
const sourceLabels: Record<PaymentSource, string> = {
  instapay: "إنستا باي",
  vodafone: "فودافون كاش",
  fawry: "myFawry",
  manual: "يدوي",
};
const sourceIcons: Record<PaymentSource, keyof typeof Ionicons.glyphMap> = {
  instapay: "swap-horizontal-outline",
  vodafone: "phone-portrait-outline",
  fawry: "receipt-outline",
  manual: "create-outline",
};
const sourceColors: Record<PaymentSource, string> = {
  instapay: C.green,
  vodafone: "#A43DA2",
  fawry: C.coral,
  manual: C.amber,
};

export default function HomeScreen() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<ExpensePeriod>("month");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      await initDatabase();
      setExpenses(await listExpenses());
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const range = getExpensePeriodRange(period);
  const confirmed = expenses.filter(
    (expense) => expense.status === "confirmed",
  );
  const periodExpenses = confirmed.filter(
    (expense) =>
      expense.occurredAt >= range.start && expense.occurredAt < range.end,
  );
  const total = periodExpenses.reduce(
    (sum, expense) => sum + expense.amountPiasters,
    0,
  );
  const pending = expenses.filter((expense) => expense.status === "pending");
  const categoryAmounts = new Map<string, number>(
    DEFAULT_CATEGORIES.map((category) => [category.id, 0]),
  );
  const sourceAmounts = new Map<PaymentSource, number>();
  for (const expense of periodExpenses) {
    categoryAmounts.set(
      expense.categoryId,
      (categoryAmounts.get(expense.categoryId) ?? 0) + expense.amountPiasters,
    );
    sourceAmounts.set(
      expense.source,
      (sourceAmounts.get(expense.source) ?? 0) + expense.amountPiasters,
    );
  }
  const categoryTotals = DEFAULT_CATEGORIES.map((category) => ({
    category,
    amount: categoryAmounts.get(category.id) ?? 0,
  }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const sourceTotals = (Object.keys(sourceLabels) as PaymentSource[])
    .map((source) => ({ source, amount: sourceAmounts.get(source) ?? 0 }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const periodLabel =
    EXPENSE_PERIODS.find((option) => option.id === period)?.label ??
    "الشهر الحالي";
  const recent = confirmed.slice(0, 4);

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topline}>
          <View>
            <Text style={s.eyebrow}>دفترك اليومي</Text>
            <Text style={s.brand}>
              مصروفي<Text style={s.brandDot}>.</Text>
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="الإعدادات"
            onPress={() => router.push("/(tabs)/settings")}
            style={s.roundButton}
          >
            <Ionicons name="settings-outline" size={21} color={C.ink} />
          </TouchableOpacity>
        </View>
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={s.periodPill}>
              <View style={s.liveDot} />
              <Text style={s.periodText}>{periodLabel}</Text>
            </View>
            <Ionicons name="wallet-outline" size={22} color="#BDE0D7" />
          </View>
          <Text style={s.heroLabel}>إجمالي المصروفات</Text>
          {loading ? (
            <ActivityIndicator
              color="#fff"
              style={{ alignSelf: "flex-end", marginTop: 10 }}
            />
          ) : (
            <Text style={s.total}>
              {formatPiasters(total, { currency: false })}
              <Text style={s.currency}> ج.م</Text>
            </Text>
          )}
          <View style={s.heroFoot}>
            <View style={s.trendBadge}>
              <Ionicons name="receipt-outline" size={14} color="#D9EEE8" />
              <Text style={s.trendText}>
                {new Intl.NumberFormat("ar-EG").format(periodExpenses.length)} عملية
                معتمدة
              </Text>
            </View>
            <Text style={s.heroFootNote}>حسب الفترة المختارة</Text>
          </View>
          <View style={s.heroRule} />
          <View style={s.quickActions}>
            <TouchableOpacity
              style={s.heroAction}
              onPress={() => router.push("/add-expense")}
            >
              <View style={s.actionCircle}>
                <Ionicons name="add" size={19} color={C.green} />
              </View>
              <Text style={s.heroActionText}>أضف مصروف</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.heroAction}
              onPress={() => router.push("/review")}
            >
              <View style={[s.actionCircle, { backgroundColor: "#F8EACB" }]}>
                <Ionicons name="sparkles-outline" size={18} color="#88621E" />
              </View>
              <Text style={s.heroActionText}>صندوق المراجعة</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.periodPicker}>
          <Text style={s.periodPickerLabel}>الفترة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.periodChips}
          >
            {EXPENSE_PERIODS.map((option) => (
              <TouchableOpacity
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: period === option.id }}
                onPress={() => setPeriod(option.id)}
                style={[
                  s.periodChip,
                  period === option.id && s.periodChipActive,
                ]}
              >
                <Text
                  style={[
                    s.periodChipText,
                    period === option.id && s.periodChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {pending.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push("/review")}
            style={s.reviewBanner}
          >
            <View style={s.reviewIcon}>
              <Ionicons name="time-outline" size={21} color="#8D661A" />
            </View>
            <View style={s.reviewCopy}>
              <Text style={s.reviewTitle}>فيه عمليات مستنياك</Text>
              <Text style={s.reviewSub}>راجعها قبل ما نضيفها لمصاريفك</Text>
            </View>
            <View style={s.pendingCount}>
              <Text style={s.pendingCountText}>
                {new Intl.NumberFormat("ar-EG").format(pending.length)}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={17} color="#94702B" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/review")}
            style={s.reviewEmpty}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color={C.green}
            />
            <Text style={s.reviewEmptyText}>صندوق المراجعة فاضي</Text>
            <Text style={s.reviewEmptyHint}>راجع العمليات الجديدة هنا</Text>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
        <View style={s.sectionHeading}>
          <View>
            <Text style={s.sectionTitle}>راحت فين؟</Text>
            <Text style={s.sectionSub}>توزيع حسب الفئة</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={s.link}>التفاصيل</Text>
          </TouchableOpacity>
        </View>
        <View style={s.categoryCard}>
          {categoryTotals.length === 0 ? (
            <View style={s.emptyInline}>
              <Ionicons name="pie-chart-outline" size={25} color="#A5AEA9" />
              <Text style={s.emptyTitle}>مفيش مصروفات في الفترة دي</Text>
              <Text style={s.emptyText}>أضف أول عملية وشوف توزيع صرفك هنا</Text>
            </View>
          ) : (
            categoryTotals.map(({ category, amount }) => (
              <View key={category.id} style={s.categoryRow}>
                <View
                  style={[s.categoryIcon, { backgroundColor: category.tint }]}
                >
                  <Ionicons
                    name={category.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={category.color}
                  />
                </View>
                <View style={s.categoryInfo}>
                  <View style={s.categoryLabels}>
                    <Text style={s.categoryName}>{category.label}</Text>
                    <Text style={s.categoryAmount}>
                      {formatPiasters(amount)}
                    </Text>
                  </View>
                  <View style={s.track}>
                    <View
                      style={[
                        s.bar,
                        {
                          backgroundColor: category.color,
                          width: `${Math.max(8, Math.round((amount / total) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={[s.sectionHeading, { marginTop: 22 }]}>
          <View>
            <Text style={s.sectionTitle}>وسيلة الدفع</Text>
            <Text style={s.sectionSub}>توزيع حسب المصدر</Text>
          </View>
        </View>
        <View style={s.categoryCard}>
          {sourceTotals.length === 0 ? (
            <View style={s.emptyInline}>
              <Ionicons name="wallet-outline" size={25} color="#A5AEA9" />
              <Text style={s.emptyTitle}>مفيش عمليات في الفترة دي</Text>
            </View>
          ) : (
            sourceTotals.map(({ source, amount }) => (
              <View key={source} style={s.categoryRow}>
                <View style={[s.categoryIcon, { backgroundColor: C.mint }]}>
                  <Ionicons
                    name={sourceIcons[source]}
                    size={18}
                    color={sourceColors[source]}
                  />
                </View>
                <View style={s.categoryInfo}>
                  <View style={s.categoryLabels}>
                    <Text style={s.categoryName}>{sourceLabels[source]}</Text>
                    <Text style={s.categoryAmount}>
                      {formatPiasters(amount)}
                    </Text>
                  </View>
                  <View style={s.track}>
                    <View
                      style={[
                        s.bar,
                        {
                          backgroundColor: sourceColors[source],
                          width: `${Math.max(8, Math.round((amount / total) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={[s.sectionHeading, { marginTop: 25 }]}>
          <View>
            <Text style={s.sectionTitle}>آخر العمليات</Text>
            <Text style={s.sectionSub}>المعتمدة فقط</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={s.link}>كل السجل</Text>
          </TouchableOpacity>
        </View>
        <View style={s.recentCard}>
          {recent.length === 0 ? (
            <View style={s.emptyInline}>
              <Ionicons name="receipt-outline" size={25} color="#A5AEA9" />
              <Text style={s.emptyTitle}>سجلك لسه فاضي</Text>
              <Text style={s.emptyText}>ابدأ بإضافة مصروف يدوي</Text>
            </View>
          ) : (
            recent.map((expense, index) => {
              const cat = getCategory(expense.categoryId);
              return (
                <View
                  key={expense.id}
                  style={[
                    s.transactionRow,
                    index === recent.length - 1 && s.noBorder,
                  ]}
                >
                  <View style={[s.categoryIcon, { backgroundColor: cat.tint }]}>
                    <Ionicons
                      name={cat.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={cat.color}
                    />
                  </View>
                  <View style={s.transactionInfo}>
                    <Text numberOfLines={1} style={s.transactionName}>
                      {expense.description || cat.label}
                    </Text>
                    <Text style={s.transactionMeta}>
                      {cat.label} · {sourceLabels[expense.source]} ·{" "}
                      {formatDate(expense.occurredAt)}
                    </Text>
                  </View>
                  <Text style={s.transactionAmount}>
                    − {formatPiasters(expense.amountPiasters)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <Text style={s.privacyNote}>◈ بياناتك محفوظة على جهازك فقط</Text>
      </ScrollView>
      <TouchableOpacity
        accessibilityLabel="إضافة مصروف"
        activeOpacity={0.9}
        onPress={() => router.push("/add-expense")}
        style={s.fab}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={s.fabText}>إضافة</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 100 },
  topline: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 19,
  },
  eyebrow: {
    color: C.muted,
    fontSize: 12,
    textAlign: "right",
    letterSpacing: 0.2,
  },
  brand: {
    color: C.ink,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 1,
  },
  brandDot: { color: C.green },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#EFEEE8",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: C.green,
    borderRadius: 26,
    padding: 20,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  periodPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 7,
  },
  liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#B7DCA9" },
  periodText: { color: "#EAF4F1", fontSize: 11, fontWeight: "600" },
  heroLabel: {
    color: "#C1DDD5",
    textAlign: "right",
    marginTop: 21,
    fontSize: 13,
  },
  total: {
    color: "#FFFFFF",
    textAlign: "right",
    fontSize: 37,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: -0.8,
  },
  currency: { fontSize: 18, fontWeight: "700", color: "#D5E9E3" },
  heroFoot: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    marginTop: 8,
  },
  trendBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  trendText: { color: "#E2F1EC", fontSize: 11, fontWeight: "600" },
  heroFootNote: { color: "#B8D7CE", fontSize: 11 },
  heroRule: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.17)",
    marginTop: 20,
  },
  quickActions: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingTop: 13,
  },
  heroAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  actionCircle: {
    width: 29,
    height: 29,
    borderRadius: 11,
    backgroundColor: "#E6F2EF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  periodPicker: { marginTop: 14, marginBottom: 1 },
  periodPickerLabel: {
    color: C.muted,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 7,
  },
  periodChips: { flexDirection: "row-reverse", gap: 7, paddingBottom: 2 },
  periodChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  periodChipActive: { backgroundColor: C.green, borderColor: C.green },
  periodChipText: { color: C.muted, fontSize: 10, fontWeight: "700" },
  periodChipTextActive: { color: C.white },
  reviewBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#FBF2DC",
    borderColor: "#F0DCA9",
    borderWidth: 1,
    borderRadius: 18,
    marginTop: 15,
    padding: 12,
    gap: 10,
  },
  reviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#F5E4B7",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCopy: { flex: 1, alignItems: "flex-end" },
  reviewTitle: { color: C.ink, fontWeight: "800", fontSize: 13 },
  reviewSub: { color: "#866A32", fontSize: 11, marginTop: 2 },
  pendingCount: {
    minWidth: 25,
    height: 25,
    borderRadius: 10,
    backgroundColor: "#E9C66E",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  pendingCountText: { color: "#584217", fontSize: 12, fontWeight: "800" },
  reviewEmpty: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    marginTop: 15,
    backgroundColor: "#E9F2EE",
    padding: 12,
    borderRadius: 15,
  },
  reviewEmptyText: { color: C.green, fontWeight: "700", fontSize: 12 },
  reviewEmptyHint: {
    color: C.muted,
    fontSize: 10,
    flex: 1,
    textAlign: "right",
  },
  sectionHeading: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 25,
    marginBottom: 12,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  sectionSub: {
    color: C.muted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  link: {
    color: C.green,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  categoryCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 11,
    gap: 11,
  },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryInfo: { flex: 1 },
  categoryLabels: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: { color: C.ink, fontWeight: "700", fontSize: 12 },
  categoryAmount: { color: C.ink, fontWeight: "700", fontSize: 12 },
  track: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "#F0F0EC",
    overflow: "hidden",
    alignItems: "flex-end",
  },
  bar: { height: 5, borderRadius: 5 },
  emptyInline: { alignItems: "center", paddingVertical: 22, gap: 5 },
  emptyTitle: { color: C.ink, fontSize: 13, fontWeight: "700", marginTop: 3 },
  emptyText: { color: C.muted, fontSize: 11 },
  recentCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 3,
  },
  transactionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomColor: C.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  noBorder: { borderBottomWidth: 0 },
  transactionInfo: { flex: 1, alignItems: "flex-end" },
  transactionName: {
    color: C.ink,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: "100%",
  },
  transactionMeta: { color: C.muted, fontSize: 10, marginTop: 4 },
  transactionAmount: { color: C.coral, fontWeight: "800", fontSize: 12 },
  privacyNote: {
    color: C.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 20,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
    borderRadius: 20,
    paddingHorizontal: 17,
    height: 51,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.ink,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

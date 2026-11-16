import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { DEFAULT_CATEGORIES, getCategory } from "@/lib/categories";
import { deleteExpense, Expense, listExpenses } from "@/lib/expense-db";
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
  white: "#FFFFFF",
};
const SOURCES = [
  { id: "all", title: "الكل" },
  { id: "manual", title: "يدوي" },
  { id: "instapay", title: "إنستا باي" },
  { id: "vodafone", title: "فودافون كاش" },
  { id: "fawry", title: "myFawry" },
];
const sourceName: Record<string, string> = {
  instapay: "إنستا باي",
  vodafone: "فودافون كاش",
  fawry: "myFawry",
  manual: "يدوي",
};
export default function TransactionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<ExpensePeriod>("month");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const load = useCallback(
    async () => setItems(await listExpenses("confirmed")),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const filtered = useMemo(() => {
    const r = getExpensePeriodRange(period);
    return items.filter(
      (x) =>
        x.occurredAt >= r.start &&
        x.occurredAt < r.end &&
        (category === "all" || x.categoryId === category) &&
        (source === "all" || x.source === source) &&
        (!query ||
          x.description.toLowerCase().includes(query.trim().toLowerCase())),
    );
  }, [items, period, category, source, query]);
  const total = filtered.reduce((sum, x) => sum + x.amountPiasters, 0);
  const remove = (item: Expense) => {
    const action = async () => {
      await deleteExpense(item.id);
      await load();
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("حذف العملية من سجلك؟")
      )
        void action();
      return;
    }
    Alert.alert("حذف العملية؟", "مش هتظهر تاني في سجلك.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => void action() },
    ]);
  };
  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>دفتر مصروفاتك</Text>
            <Text style={s.title}>سجل العمليات</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/add-expense")}
            style={s.add}
          >
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={s.addText}>إضافة</Text>
          </TouchableOpacity>
        </View>
        <View style={s.summary}>
          <View>
            <Text style={s.sumLabel}>
              {EXPENSE_PERIODS.find((option) => option.id === period)?.label ??
                "الشهر الحالي"}
            </Text>
            <Text style={s.sumAmount}>{formatPiasters(total)}</Text>
          </View>
          <View style={s.countBox}>
            <Text style={s.count}>{filtered.length}</Text>
            <Text style={s.countLabel}>عملية</Text>
          </View>
        </View>
        <View style={s.search}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="دور على وصف العملية"
            placeholderTextColor="#969F99"
            style={s.searchInput}
          />
        </View>
        <View style={s.filterHead}>
          <Text style={s.filterTitle}>الفترة</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontal}
        >
          {EXPENSE_PERIODS.map((x) => (
            <TouchableOpacity
              key={x.id}
              onPress={() => setPeriod(x.id)}
              style={[s.chip, period === x.id && s.chipActive]}
            >
              <Text style={[s.chipText, period === x.id && s.chipTextActive]}>
                {x.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={s.filterHead}>
          <Text style={s.filterTitle}>الفئة</Text>
          <TouchableOpacity onPress={() => setCategory("all")}>
            <Text style={s.reset}>مسح</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontal}
        >
          {[{ id: "all", label: "الكل" }, ...DEFAULT_CATEGORIES].map((x) => (
            <TouchableOpacity
              key={x.id}
              onPress={() => setCategory(x.id)}
              style={[s.chip, category === x.id && s.chipActive]}
            >
              <Text style={[s.chipText, category === x.id && s.chipTextActive]}>
                {x.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={s.filterHead}>
          <Text style={s.filterTitle}>مصدر الدفع</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontal}
        >
          {SOURCES.map((x) => (
            <TouchableOpacity
              key={x.id}
              onPress={() => setSource(x.id)}
              style={[s.chip, source === x.id && s.chipActive]}
            >
              <Text style={[s.chipText, source === x.id && s.chipTextActive]}>
                {x.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={s.listHeading}>
          <Text style={s.listTitle}>العمليات</Text>
          <Text style={s.listCount}>{filtered.length} نتائج</Text>
        </View>
        <View style={s.list}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="file-tray-outline" size={29} color="#A7B0AA" />
              <Text style={s.emptyTitle}>مفيش عمليات مطابقة</Text>
              <Text style={s.emptyText}>
                جرّب تغيّر الفلاتر أو أضف مصروف جديد
              </Text>
            </View>
          ) : (
            filtered.map((item, index) => {
              const cat = getCategory(item.categoryId);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  key={item.id}
                  onPress={() =>
                    router.push(
                      `/add-expense?id=${encodeURIComponent(item.id)}`,
                    )
                  }
                  style={[s.row, index === filtered.length - 1 && s.last]}
                >
                  <View style={s.rowActions}>
                    <TouchableOpacity
                      onPress={(event) => {
                        event.stopPropagation();
                        remove(item);
                      }}
                      style={s.trash}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#9B6C61"
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={s.catIcon}>
                    <Ionicons
                      name={cat.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={cat.color}
                    />
                  </View>
                  <View style={s.rowInfo}>
                    <Text numberOfLines={1} style={s.rowTitle}>
                      {item.description || cat.label}
                    </Text>
                    <Text style={s.meta}>
                      {cat.label} · {sourceName[item.source]} ·{" "}
                      {formatDate(item.occurredAt, true)}
                    </Text>
                  </View>
                  <Text style={s.amount}>
                    − {formatPiasters(item.amountPiasters)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <Text style={s.privacy}>السجل محفوظ محليًا على جهازك · لا مزامنة</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  kicker: { fontSize: 11, color: C.muted, textAlign: "right" },
  title: {
    fontSize: 23,
    color: C.ink,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 3,
  },
  add: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.green,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  summary: {
    backgroundColor: C.ink,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  sumLabel: { color: "#B9C9C3", fontSize: 11, textAlign: "right" },
  sumAmount: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 5,
  },
  countBox: {
    backgroundColor: "rgba(255,255,255,.1)",
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  count: { color: "#fff", fontWeight: "800", fontSize: 17 },
  countLabel: { color: "#D0DBD7", fontSize: 10 },
  search: {
    height: 46,
    backgroundColor: C.white,
    borderRadius: 15,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 8,
  },
  searchInput: { flex: 1, color: C.ink, textAlign: "right", fontSize: 12 },
  filterHead: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 17,
    marginBottom: 9,
  },
  filterTitle: { color: C.ink, fontSize: 12, fontWeight: "800" },
  reset: { color: C.green, fontSize: 11 },
  chips: { flexDirection: "row-reverse", gap: 8 },
  horizontal: { flexDirection: "row-reverse", gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E4E2D9",
    backgroundColor: "#FBFAF7",
  },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: "#5F6B65", fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  listHeading: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 23,
    marginBottom: 10,
  },
  listTitle: { fontSize: 16, color: C.ink, fontWeight: "800" },
  listCount: { fontSize: 11, color: C.muted },
  list: { backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 13 },
  row: {
    minHeight: 70,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  last: { borderBottomWidth: 0 },
  rowActions: { width: 22 },
  trash: { padding: 5 },
  catIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#F3EEE7",
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowTitle: { fontSize: 12, fontWeight: "700", color: C.ink, maxWidth: "100%" },
  meta: { fontSize: 10, color: C.muted, marginTop: 4 },
  amount: { fontSize: 11, color: C.coral, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 30, gap: 6 },
  emptyTitle: { color: C.ink, fontSize: 13, fontWeight: "700" },
  emptyText: { color: C.muted, fontSize: 10, textAlign: "center" },
  privacy: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 18 },
});

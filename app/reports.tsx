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
import { listExpenses } from "@/lib/expense-db";
import type { Expense } from "@/lib/expense-db";
import { loadPaymentMethods } from "@/lib/personalization";
import type { PaymentMethod } from "@/lib/personalization";
import { formatPiasters } from "@/lib/money";
import { getMonthStart, getMonthlySourceReport } from "@/lib/monthly-report";

const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  white: "#FFFFFF",
  mint: "#E6F1EE",
  coral: "#C65F47",
  purple: "#A43DA2",
  gold: "#D5A13D",
};
const SOURCE_COLORS: Record<string, string> = {
  cash: C.green,
  manual: C.gold,
  instapay: "#247A76",
  vodafone: C.purple,
  fawry: C.coral,
};

export default function MonthlyReportsScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(() => getMonthStart(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [nextExpenses, nextMethods] = await Promise.all([
      listExpenses(),
      loadPaymentMethods(),
    ]);
    setExpenses(nextExpenses);
    setMethods(nextMethods);
    setLoading(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const report = getMonthlySourceReport(expenses, month);
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
  }).format(month);
  const labelFor = (source: string) => methods.find((method) => method.id === source)?.label ?? source;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-forward" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>تحليل مصروفاتك</Text>
            <Text style={s.title}>التقرير الشهري</Text>
          </View>
        </View>

        <View style={s.monthPicker}>
          <TouchableOpacity onPress={() => setMonth((current) => getMonthStart(current, 1))} style={s.monthArrow} accessibilityLabel="الشهر التالي">
            <Ionicons name="chevron-forward" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={s.monthCenter}>
            <Ionicons name="calendar-outline" size={18} color={C.green} />
            <Text style={s.monthLabel}>{monthLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => setMonth((current) => getMonthStart(current, -1))} style={s.monthArrow} accessibilityLabel="الشهر السابق">
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>

        <View style={s.hero}>
          <Text style={s.heroLabel}>إجمالي المصروفات المعتمدة</Text>
          {loading ? <ActivityIndicator color="#fff" style={{ marginTop: 11 }} /> : (
            <Text style={s.total}>{formatPiasters(report.totalPiasters)}</Text>
          )}
          <View style={s.heroFoot}>
            <Ionicons name="receipt-outline" size={14} color="#D9EEE8" />
            <Text style={s.heroCount}>{new Intl.NumberFormat("ar-EG").format(report.expenseCount)} عملية خلال الشهر</Text>
          </View>
        </View>

        <View style={s.sectionHead}>
          <View>
            <Text style={s.sectionTitle}>توزيع الدفع</Text>
            <Text style={s.sectionSub}>المبلغ والنسبة لكل وسيلة دفع</Text>
          </View>
          <View style={s.smallIcon}><Ionicons name="pie-chart-outline" size={18} color={C.green} /></View>
        </View>

        <View style={s.card}>
          {loading ? (
            <ActivityIndicator color={C.green} style={{ padding: 24 }} />
          ) : report.rows.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bar-chart-outline" size={28} color="#A5AEA9" />
              <Text style={s.emptyTitle}>لا توجد مصروفات معتمدة في هذا الشهر</Text>
              <Text style={s.emptyHint}>اختاري شهرًا آخر أو سجّلي عملية جديدة.</Text>
            </View>
          ) : report.rows.map((row, index) => {
            const color = SOURCE_COLORS[row.source] ?? C.green;
            return (
              <View key={row.source} style={[s.row, index === report.rows.length - 1 && s.lastRow]}>
                <View style={[s.dotIcon, { backgroundColor: `${color}18` }]}>
                  <Ionicons name={row.source === "cash" ? "cash-outline" : "wallet-outline"} size={17} color={color} />
                </View>
                <View style={s.rowMain}>
                  <View style={s.rowTitleLine}>
                    <Text style={s.amount}>{formatPiasters(row.amountPiasters)}</Text>
                    <Text style={s.method}>{labelFor(row.source)}</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { backgroundColor: color, width: `${Math.max(2, row.percent)}%` }]} />
                  </View>
                  <Text style={s.rowMeta}>{new Intl.NumberFormat("ar-EG").format(row.count)} عملية</Text>
                </View>
                <Text style={[s.percent, { color }]}>{new Intl.NumberFormat("ar-EG").format(row.percent)}٪</Text>
              </View>
            );
          })}
        </View>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={16} color={C.green} />
          <Text style={s.noteText}>يشمل التقرير المصروفات المعتمدة فقط. العمليات المعلّقة والدخل والرواتب لا تدخل في إجمالي المصروفات.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 19, paddingTop: 17, paddingBottom: 40 },
  header: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 18 },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#EFEEE8", alignItems: "center", justifyContent: "center" },
  eyebrow: { color: C.muted, fontSize: 11, textAlign: "right" },
  title: { color: C.ink, fontSize: 23, fontWeight: "800", textAlign: "right", marginTop: 2 },
  monthPicker: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.white, borderRadius: 15, paddingHorizontal: 7, marginBottom: 13, borderWidth: 1, borderColor: C.line },
  monthArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  monthCenter: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  monthLabel: { color: C.ink, fontWeight: "800", fontSize: 13 },
  hero: { backgroundColor: C.green, borderRadius: 23, padding: 19 },
  heroLabel: { color: "#C1DDD5", textAlign: "right", fontSize: 12 },
  total: { color: C.white, textAlign: "right", fontSize: 30, fontWeight: "800", marginTop: 8 },
  heroFoot: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 9 },
  heroCount: { color: "#E2F1EC", fontSize: 10, fontWeight: "700" },
  sectionHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: "800", textAlign: "right" },
  sectionSub: { color: C.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  smallIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: "#F0EEE8" },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  lastRow: { borderBottomWidth: 0 },
  dotIcon: { width: 37, height: 37, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  amount: { color: C.ink, fontSize: 12, fontWeight: "800" },
  method: { color: C.ink, fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 5, borderRadius: 4, overflow: "hidden", backgroundColor: "#F0F0EC", marginTop: 8, alignItems: "flex-end" },
  progressFill: { height: 5, borderRadius: 4 },
  rowMeta: { color: C.muted, fontSize: 9, textAlign: "right", marginTop: 4 },
  percent: { width: 36, textAlign: "left", fontSize: 12, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 30, gap: 7 },
  emptyTitle: { color: C.ink, fontSize: 12, fontWeight: "700", textAlign: "center" },
  emptyHint: { color: C.muted, fontSize: 10, textAlign: "center" },
  note: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 7, backgroundColor: C.mint, borderRadius: 13, padding: 11, marginTop: 13 },
  noteText: { flex: 1, color: C.green, textAlign: "right", fontSize: 10, lineHeight: 16 },
});

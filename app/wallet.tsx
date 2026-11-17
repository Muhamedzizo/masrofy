import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteSalaryRule,
  initDatabase,
  listBalanceEvents,
  listExpenses,
  listSalaryRules,
} from "@/lib/expense-db";
import type { BalanceEvent, SalaryRule, WalletBalance } from "@/lib/wallet-model";
import {
  addOpeningBalance,
  addTopUp,
  accrueDueSalaries,
  createMonthlySalary,
} from "@/lib/wallet";
import { loadPaymentMethods } from "@/lib/personalization";
import type { PaymentMethod } from "@/lib/personalization";
import { calculateWalletBalances } from "@/lib/wallet-model";
import { formatDate, formatPiasters, parseAmountToPiasters } from "@/lib/money";

const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  white: "#FFFFFF",
  mint: "#E6F1EE",
  gold: "#D5A13D",
  coral: "#C65F47",
};

export default function WalletScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [source, setSource] = useState("cash");
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [events, setEvents] = useState<BalanceEvent[]>([]);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [openingAmount, setOpeningAmount] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpDescription, setTopUpDescription] = useState("");
  const [salaryLabel, setSalaryLabel] = useState("المرتب الشهري");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryDay, setSalaryDay] = useState("1");
  const [salarySource, setSalarySource] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    await initDatabase();
    await accrueDueSalaries();
    const [nextMethods, expenses, nextEvents, nextRules] = await Promise.all([
      loadPaymentMethods(),
      listExpenses(),
      listBalanceEvents(),
      listSalaryRules(),
    ]);
    setMethods(nextMethods);
    setEvents(nextEvents);
    setRules(nextRules);
    setBalances(
      calculateWalletBalances(
        nextMethods.map((item) => item.id),
        nextEvents,
        expenses,
      ).filter((item) => item.isTracked),
    );
    setSource((current) =>
      nextMethods.some((item) => item.id === current)
        ? current
        : (nextMethods[0]?.id ?? "cash"),
    );
    setSalarySource((current) =>
      nextMethods.some((item) => item.id === current)
        ? current
        : (nextMethods[0]?.id ?? "cash"),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh()
        .catch((reason) => {
          if (active) setError(reason instanceof Error ? reason.message : "تعذر تحميل الأرصدة.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ التغيير.");
    } finally {
      setBusy(false);
    }
  };

  const setOpening = () => {
    const piasters = parseAmountToPiasters(openingAmount);
    if (!piasters) {
      setError("اكتب الرصيد الحالي بالجنيه، أكبر من صفر.");
      return;
    }
    void run(async () => {
      await addOpeningBalance(source, piasters);
      setOpeningAmount("");
    });
  };

  const addMoney = () => {
    const piasters = parseAmountToPiasters(topUpAmount);
    if (!piasters) {
      setError("اكتب مبلغًا أكبر من صفر.");
      return;
    }
    void run(async () => {
      await addTopUp(source, piasters, topUpDescription || "إضافة رصيد");
      setTopUpAmount("");
      setTopUpDescription("");
    });
  };

  const addSalary = () => {
    const piasters = parseAmountToPiasters(salaryAmount);
    const day = Number(salaryDay);
    if (!piasters || !Number.isInteger(day) || day < 1 || day > 31) {
      setError("أدخل مبلغًا صحيحًا ويومًا من 1 إلى 31.");
      return;
    }
    void run(async () => {
      await createMonthlySalary({
        label: salaryLabel || "المرتب الشهري",
        amountPiasters: piasters,
        source: salarySource,
        dayOfMonth: day,
      });
      setSalaryAmount("");
      Alert.alert("تم", "سجلنا موعد الراتب. يُضاف عند موعده، أو عند فتح التطبيق بعده إذا كان التطبيق مغلقًا.");
    });
  };

  const total = balances.reduce((sum, item) => sum + item.balancePiasters, 0);
  const getLabel = (id: string) => methods.find((item) => item.id === id)?.label ?? id;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-forward" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>محافظك وطرق الدفع</Text>
            <Text style={s.title}>الأرصدة</Text>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroLabel}>إجمالي الرصيد المسجّل</Text>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.total}>{formatPiasters(total)}</Text>}
          <Text style={s.heroNote}>محسوب من الأرصدة التي أدخلتها والدخول المؤكد ناقص المصروفات المعتمدة.</Text>
        </View>

        {balances.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>الرصيد حسب وسيلة الدفع</Text>
            {balances.map((item) => (
              <View key={item.source} style={s.balanceRow}>
                <View style={s.icon}><Ionicons name={item.source === "cash" ? "cash-outline" : "wallet-outline"} size={18} color={C.green} /></View>
                <Text style={s.methodName}>{getLabel(item.source)}</Text>
                <Text style={s.balanceAmount}>{formatPiasters(item.balancePiasters)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>حدّدي طريقة الدفع</Text>
          <View style={s.chips}>
            {methods.map((method) => (
              <TouchableOpacity key={method.id} onPress={() => setSource(method.id)} style={[s.chip, source === method.id && s.chipOn]}>
                <Text style={[s.chipText, source === method.id && s.chipTextOn]}>{method.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>سجّلي الرصيد الموجود الآن</Text>
          <Text style={s.copy}>مثال: معك 20 جنيه على فوري، سجّلي 20 مرة واحدة كرصيد بداية. المصروفات المعتمدة على هذه الوسيلة ستخصم منه.</Text>
          <MoneyInput value={openingAmount} onChangeText={setOpeningAmount} placeholder="الرصيد الحالي بالجنيه" />
          <Button label="حفظ الرصيد الحالي" icon="save-outline" busy={busy} onPress={setOpening} />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>إضافة فلوس في أي وقت</Text>
          <Text style={s.copy}>كل إضافة تُسجل كحركة جديدة وتزيد رصيد طريقة الدفع المختارة.</Text>
          <MoneyInput value={topUpAmount} onChangeText={setTopUpAmount} placeholder="المبلغ بالجنيه" />
          <TextInput value={topUpDescription} onChangeText={setTopUpDescription} placeholder="ملاحظة، مثل: تحويل أو شحن" placeholderTextColor="#9AA39E" style={s.input} textAlign="right" />
          <Button label="إضافة للرصيد" icon="add-circle-outline" busy={busy} onPress={addMoney} />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>مرتب ثابت كل شهر</Text>
          <Text style={s.copy}>اختاري يوم نزوله والمكان الذي يصل إليه. إذا كان التطبيق مغلقًا يوم الراتب، يسجله مرة واحدة عند فتح التطبيق لاحقًا؛ لا يحتاج أن يكون مفتوحًا وقت نزوله.</Text>
          <TextInput value={salaryLabel} onChangeText={setSalaryLabel} placeholder="اسم الدخل" placeholderTextColor="#9AA39E" style={s.input} textAlign="right" />
          <MoneyInput value={salaryAmount} onChangeText={setSalaryAmount} placeholder="قيمة المرتب بالجنيه" />
          <TextInput value={salaryDay} onChangeText={setSalaryDay} placeholder="يوم نزول المرتب (1–31)" placeholderTextColor="#9AA39E" style={s.input} keyboardType="number-pad" textAlign="right" />
          <Text style={s.fieldLabel}>يُضاف إلى</Text>
          <View style={s.chips}>
            {methods.map((method) => (
              <TouchableOpacity key={method.id} onPress={() => setSalarySource(method.id)} style={[s.chip, salarySource === method.id && s.chipOn]}>
                <Text style={[s.chipText, salarySource === method.id && s.chipTextOn]}>{method.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button label="حفظ موعد المرتب الشهري" icon="calendar-outline" busy={busy} onPress={addSalary} />
          {rules.map((rule) => (
            <View key={rule.id} style={s.ruleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.methodName}>{rule.label}</Text>
                <Text style={s.copySmall}>{formatPiasters(rule.amountPiasters)} · يوم {rule.dayOfMonth} · {getLabel(rule.source)}</Text>
              </View>
              <TouchableOpacity onPress={() => Alert.alert("إيقاف المرتب المتكرر؟", "ستبقى الحركات التي سُجلت بالفعل محفوظة.", [{ text: "رجوع", style: "cancel" }, { text: "إيقاف", style: "destructive", onPress: () => void run(() => deleteSalaryRule(rule.id)) }])}>
                <Ionicons name="trash-outline" size={19} color={C.coral} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>آخر إضافات الرصيد</Text>
          {events.length === 0 ? <Text style={s.copy}>لا توجد إضافات بعد. سجّلي الرصيد الحالي للبدء.</Text> : events.slice(0, 12).map((event) => (
            <View key={event.id} style={s.eventRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.methodName}>{event.description || "إضافة رصيد"}</Text>
                <Text style={s.copySmall}>{getLabel(event.source)} · {formatDate(event.occurredAt)}</Text>
              </View>
              <Text style={s.eventAmount}>+ {formatPiasters(event.amountPiasters)}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
        <Text style={s.footnote}>كل الأرصدة والرواتب محفوظة محليًا على هذا الهاتف. المبالغ الملتقطة من الإشعارات لا تُخصم إلا بعد تأكيدها.</Text>
      </ScrollView>
    </View>
  );
}

function MoneyInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor="#9AA39E" style={s.input} textAlign="right" />;
}

function Button({ label, icon, busy, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; busy: boolean; onPress: () => void }) {
  return <TouchableOpacity disabled={busy} onPress={onPress} style={[s.button, busy && { opacity: 0.65 }]}>
    {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={18} color="#fff" />}
    {!busy && <Text style={s.buttonText}>{label}</Text>}
  </TouchableOpacity>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { padding: 18, paddingBottom: 45 },
  header: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 17 },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#EFEEE8", alignItems: "center", justifyContent: "center" },
  eyebrow: { textAlign: "right", color: C.muted, fontSize: 11 },
  title: { textAlign: "right", color: C.ink, fontSize: 23, fontWeight: "800", marginTop: 2 },
  hero: { backgroundColor: C.green, borderRadius: 23, padding: 18, marginBottom: 13 },
  heroLabel: { color: "#C1DDD5", textAlign: "right", fontSize: 12 },
  total: { color: C.white, textAlign: "right", fontSize: 30, fontWeight: "800", marginTop: 8 },
  heroNote: { color: "#D5E9E3", textAlign: "right", fontSize: 10, lineHeight: 17, marginTop: 8 },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 15, marginBottom: 12, borderColor: "#F0EEE8", borderWidth: 1 },
  cardTitle: { color: C.ink, fontWeight: "800", fontSize: 14, textAlign: "right", marginBottom: 7 },
  copy: { color: C.muted, fontSize: 11, textAlign: "right", lineHeight: 18, marginBottom: 5 },
  copySmall: { color: C.muted, fontSize: 9, textAlign: "right", marginTop: 4 },
  input: { minHeight: 45, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: "#FCFBF8", paddingHorizontal: 12, marginTop: 8, color: C.ink, fontSize: 12 },
  chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, paddingTop: 7 },
  chip: { backgroundColor: "#FCFBF8", borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: C.mint, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 10, fontWeight: "700" },
  chipTextOn: { color: C.green },
  fieldLabel: { color: C.muted, fontSize: 10, textAlign: "right", marginTop: 11 },
  button: { minHeight: 44, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.green, borderRadius: 13, paddingHorizontal: 12, marginTop: 11 },
  buttonText: { color: C.white, fontSize: 12, fontWeight: "800" },
  balanceRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderTopColor: C.line, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  icon: { width: 33, height: 33, borderRadius: 11, backgroundColor: C.mint, alignItems: "center", justifyContent: "center" },
  methodName: { flex: 1, textAlign: "right", color: C.ink, fontSize: 11, fontWeight: "700" },
  balanceAmount: { color: C.green, fontWeight: "800", fontSize: 12 },
  ruleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderTopColor: C.line, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, marginTop: 9 },
  eventRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderTopColor: C.line, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  eventAmount: { color: C.green, fontSize: 10, fontWeight: "800" },
  error: { color: C.coral, textAlign: "right", fontSize: 11, marginBottom: 10 },
  footnote: { color: C.muted, textAlign: "center", fontSize: 9, lineHeight: 16, marginTop: 4 },
});

import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import {
  createExpenseId,
  Expense,
  listExpenses,
  PaymentSource,
  saveExpense,
} from "@/lib/expense-db";
import { parseAmountToPiasters } from "@/lib/money";
const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  white: "#FFFFFF",
  coral: "#C65F47",
};
const SOURCES: { id: PaymentSource; label: string }[] = [
  { id: "manual", label: "يدوي" },
  { id: "instapay", label: "إنستا باي" },
  { id: "vodafone", label: "فودافون كاش" },
  { id: "fawry", label: "myFawry" },
];
const nowLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const parseDate = (value: string) => {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const d = new Date(
    year,
    month,
    day,
    hour,
    minute,
  );
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== minute
  ) {
    return null;
  }
  return d.getTime();
};
export default function AddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    review?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const reviewing =
    (Array.isArray(params.review) ? params.review[0] : params.review) === "1";
  const [original, setOriginal] = useState<Expense | undefined>();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food");
  const [source, setSource] = useState<PaymentSource>("manual");
  const [date, setDate] = useState(nowLocal());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!id) return;
    void listExpenses().then((rows) => {
      const item = rows.find((x) => x.id === id);
      if (!item) {
        setError("العملية غير موجودة");
        return;
      }
      setOriginal(item);
      setAmount((item.amountPiasters / 100).toFixed(2));
      setDescription(item.description);
      setCategory(item.categoryId);
      setSource(item.source);
      const d = new Date(item.occurredAt);
      setDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    });
  }, [id]);
  const submit = async () => {
    const piasters = parseAmountToPiasters(amount);
    const timestamp = parseDate(date);
    if (!piasters) {
      setError("اكتب مبلغ صحيح أكبر من صفر، حتى خانتين عشريتين.");
      return;
    }
    if (!timestamp) {
      setError("اكتب التاريخ بالشكل سنة-شهر-يوم ساعة:دقيقة.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const item: Expense = {
        id: original?.id || createExpenseId(),
        amountPiasters: piasters,
        occurredAt: timestamp,
        source,
        description:
          description.trim() ||
          DEFAULT_CATEGORIES.find((c) => c.id === category)?.label ||
          "مصروف",
        categoryId: category,
        status: reviewing ? "confirmed" : (original?.status ?? "confirmed"),
        origin: original?.origin ?? "manual",
        sourceEventId: original?.sourceEventId,
      };
      await saveExpense(item);
      router.back();
    } catch {
      setError("ما قدرناش نحفظ العملية. حاول تاني.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-forward" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>
              {reviewing ? "اقتراح من إشعار" : "سجّلها على طول"}
            </Text>
            <Text style={s.title}>
              {reviewing
                ? "تعديل قبل التأكيد"
                : original
                  ? "تعديل المصروف"
                  : "مصروف جديد"}
            </Text>
          </View>
        </View>
        <View style={s.amountCard}>
          <Text style={s.label}>المبلغ</Text>
          <View style={s.amountLine}>
            <Text style={s.currency}>ج.م</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#A6AEA8"
              style={s.amountInput}
              textAlign="right"
            />
          </View>
          <Text style={s.helper}>أدخل المبلغ بالجنيه المصري</Text>
        </View>
        <Text style={s.label}>الوصف</Text>
        <View style={s.field}>
          <Ionicons name="create-outline" size={18} color={C.muted} />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="مثال: غداء مع الأصدقاء"
            placeholderTextColor="#9AA29C"
            style={s.input}
          />
        </View>
        <Text style={s.label}>التاريخ والوقت</Text>
        <View style={s.field}>
          <Ionicons name="calendar-outline" size={18} color={C.muted} />
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="2026-11-16 12:30"
            placeholderTextColor="#9AA29C"
            style={s.input}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setDate(nowLocal())}>
            <Text style={s.now}>الآن</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.tiny}>الصيغة: سنة-شهر-يوم ساعة:دقيقة</Text>
        <Text style={s.label}>الفئة</Text>
        <View style={s.categoryGrid}>
          {DEFAULT_CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setCategory(item.id)}
              style={[s.category, category === item.id && s.categoryOn]}
            >
              <View style={[s.catIcon, { backgroundColor: item.tint }]}>
                <Ionicons
                  name={item.icon as keyof typeof Ionicons.glyphMap}
                  size={17}
                  color={item.color}
                />
              </View>
              <Text style={[s.catLabel, category === item.id && s.catLabelOn]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>مصدر الدفع</Text>
        <View style={s.sourceGrid}>
          {SOURCES.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setSource(item.id)}
              style={[s.source, source === item.id && s.sourceOn]}
            >
              <View style={[s.radio, source === item.id && s.radioOn]}>
                {source === item.id ? <View style={s.radioDot} /> : null}
              </View>
              <Text
                style={[s.sourceText, source === item.id && s.sourceTextOn]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.coral} />
            <Text style={s.error}>{error}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          disabled={saving}
          onPress={() => void submit()}
          style={[s.save, saving && { opacity: 0.65 }]}
        >
          <Ionicons
            name={reviewing ? "checkmark-circle-outline" : "checkmark"}
            size={19}
            color="#fff"
          />
          <Text style={s.saveText}>
            {saving
              ? "جارٍ الحفظ…"
              : reviewing
                ? "تأكيد وإضافة للسجل"
                : "حفظ المصروف"}
          </Text>
        </TouchableOpacity>
        <Text style={s.private}>هذه العملية ستُحفظ محليًا على جهازك فقط.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 35 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EFEEE8",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { color: C.muted, fontSize: 11, textAlign: "right" },
  title: {
    color: C.ink,
    fontSize: 21,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 2,
  },
  amountCard: {
    backgroundColor: C.ink,
    borderRadius: 22,
    padding: 17,
    marginBottom: 18,
  },
  label: {
    color: C.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 14,
    marginBottom: 8,
  },
  amountCardLabel: { color: "#D2DDD8" },
  amountLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    marginTop: 8,
  },
  currency: { color: "#B5C5BF", fontWeight: "700", fontSize: 16 },
  amountInput: {
    flex: 1,
    fontSize: 35,
    fontWeight: "800",
    color: "#fff",
    paddingVertical: 3,
  },
  helper: { color: "#B8C7C1", fontSize: 10, textAlign: "right", marginTop: 2 },
  field: {
    minHeight: 48,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    color: C.ink,
    textAlign: "right",
    fontSize: 12,
    paddingVertical: 11,
  },
  now: { color: C.green, fontSize: 11, fontWeight: "700" },
  tiny: { fontSize: 9, color: C.muted, textAlign: "right", marginTop: 5 },
  categoryGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  category: {
    width: "31.5%",
    backgroundColor: C.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 10,
    alignItems: "center",
    gap: 6,
  },
  categoryOn: { borderColor: C.green, backgroundColor: "#F0F7F4" },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { fontSize: 10, color: C.muted, fontWeight: "600" },
  catLabelOn: { color: C.green, fontWeight: "800" },
  sourceGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  source: {
    width: "48%",
    minHeight: 42,
    backgroundColor: C.white,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sourceOn: { borderColor: C.green, backgroundColor: "#F0F7F4" },
  radio: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#B6BFB9",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: C.green },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  sourceText: { color: C.muted, fontSize: 10, fontWeight: "600" },
  sourceTextOn: { color: C.green, fontWeight: "800" },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
  },
  error: { color: C.coral, fontSize: 11, textAlign: "right", flex: 1 },
  save: {
    height: 51,
    backgroundColor: C.green,
    borderRadius: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 23,
  },
  saveText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  private: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 13 },
});

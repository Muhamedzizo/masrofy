import { useCallback, useState } from "react";
import {
  Alert,
  Platform as RNPlatform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { getCategory } from "@/lib/categories";
import {
  deleteExpense,
  Expense,
  ingestCandidates,
  listExpenses,
  saveExpense,
} from "@/lib/expense-db";
import { formatDate, formatPiasters } from "@/lib/money";
import {
  acknowledgeCandidates,
  drainPendingCandidates,
} from "@/lib/notification-bridge";
const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  amber: "#D5A13D",
  white: "#FFFFFF",
  line: "#E8E5DC",
  coral: "#C65F47",
};
const src: Record<string, string> = {
  instapay: "إنستا باي",
  vodafone: "فودافون كاش",
  fawry: "myFawry",
  manual: "يدوي",
};
export default function ReviewScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Expense[]>([]);
  const [syncNote, setSyncNote] = useState("");
  const load = useCallback(async () => {
    if (RNPlatform.OS === "android") {
      try {
        const candidates = await drainPendingCandidates();
        if (candidates.length) {
          await ingestCandidates(candidates);
          await acknowledgeCandidates(candidates.map((c) => c.id));
        }
        setSyncNote("");
      } catch {
        setSyncNote(
          "تعذّر الاتصال بخدمة الالتقاط حاليًا. تقدر تضيف مصروف يدويًا.",
        );
      }
    }
    setItems(await listExpenses("pending"));
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const actionConfirm = (item: Expense) => {
    void saveExpense({ ...item, status: "confirmed" }).then(load);
  };
  const actionDelete = (item: Expense) => {
    const run = () => void deleteExpense(item.id).then(load);
    if (RNPlatform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("حذف الاقتراح نهائيًا؟")
      )
        run();
      return;
    }
    Alert.alert("حذف الاقتراح؟", "لن يُضاف هذا المصروف إلى السجل.", [
      { text: "رجوع", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: run },
    ]);
  };
  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-forward" size={20} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>خطوة قبل السجل</Text>
            <Text style={s.title}>صندوق المراجعة</Text>
          </View>
          <View style={s.count}>
            <Text style={s.countNum}>{items.length}</Text>
          </View>
        </View>
        <View style={s.note}>
          <View style={s.noteIcon}>
            <Ionicons name="eye-outline" size={20} color="#8B6720" />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={s.noteTitle}>قرارك هو الأساس</Text>
            <Text style={s.noteText}>
              العمليات المقترحة مش محسوبة ضمن إجمالياتك. راجع كل واحدة وأكّدها
              أو عدّلها أو احذفها.
            </Text>
          </View>
        </View>
        {syncNote ? (
          <View style={s.warning}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#8B6720"
            />
            <Text style={s.warningText}>{syncNote}</Text>
          </View>
        ) : null}
        {items.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons
                name="checkmark-done-outline"
                size={27}
                color={C.green}
              />
            </View>
            <Text style={s.emptyTitle}>كله تمام</Text>
            <Text style={s.emptyText}>مفيش عمليات محتاجة مراجعة دلوقتي.</Text>
            <Text style={s.emptySmall}>
              أي اقتراح جديد هيظهر هنا قبل ما يدخل سجلك.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const cat = getCategory(item.categoryId);
            return (
              <View style={s.card} key={item.id}>
                <View style={s.cardTop}>
                  <View style={s.tag}>
                    <View style={s.tagDot} />
                    <Text style={s.tagText}>بانتظارك</Text>
                  </View>
                  <Text style={s.date}>
                    {formatDate(item.occurredAt, true)}
                  </Text>
                </View>
                <View style={s.amountBlock}>
                  <Text style={s.amount}>
                    {formatPiasters(item.amountPiasters)}
                  </Text>
                  <View style={s.details}>
                    <Text style={s.description}>
                      {item.description || "عملية جديدة"}
                    </Text>
                    <Text style={s.meta}>
                      {src[item.source]} · {cat.label}
                    </Text>
                  </View>
                </View>
                <View style={s.rule} />
                <View style={s.actions}>
                  <TouchableOpacity
                    onPress={() => actionDelete(item)}
                    style={s.delete}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.coral} />
                    <Text style={s.deleteText}>حذف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/add-expense?id=${encodeURIComponent(item.id)}&review=1`,
                      )
                    }
                    style={s.edit}
                  >
                    <Ionicons name="create-outline" size={16} color={C.green} />
                    <Text style={s.editText}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => actionConfirm(item)}
                    style={s.confirm}
                  >
                    <Ionicons name="checkmark" size={17} color="#fff" />
                    <Text style={s.confirmText}>تأكيد الإضافة</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <TouchableOpacity
          onPress={() => router.push("/add-expense")}
          style={s.manual}
        >
          <Ionicons name="add-circle-outline" size={19} color={C.green} />
          <Text style={s.manualText}>إضافة مصروف يدوي</Text>
        </TouchableOpacity>
        <Text style={s.privacy}>لا يتم حفظ نص الإشعار الأصلي أو إرساله</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
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
  kicker: { color: C.muted, textAlign: "right", fontSize: 11 },
  title: {
    color: C.ink,
    textAlign: "right",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  count: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#F5E8C7",
    alignItems: "center",
    justifyContent: "center",
  },
  countNum: { color: "#795D20", fontWeight: "800", fontSize: 15 },
  note: {
    backgroundColor: "#FBF2DC",
    borderRadius: 17,
    padding: 13,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 17,
  },
  noteIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#F3E5C0",
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: {
    color: C.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  noteText: {
    color: "#786641",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
    marginTop: 4,
  },
  warning: {
    flexDirection: "row-reverse",
    gap: 8,
    padding: 11,
    backgroundColor: "#FFF8E8",
    borderRadius: 13,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    color: "#745820",
    lineHeight: 17,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 43,
    paddingHorizontal: 18,
    backgroundColor: C.white,
    borderRadius: 22,
    marginTop: 3,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#E7F1EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  emptyTitle: { color: C.ink, fontSize: 18, fontWeight: "800" },
  emptyText: { color: C.ink, fontSize: 12, marginTop: 7 },
  emptySmall: {
    color: C.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 21,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0E9D8",
  },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tag: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FBF2DC",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.amber },
  tagText: { fontSize: 10, fontWeight: "700", color: "#806023" },
  date: { fontSize: 10, color: C.muted },
  amountBlock: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 14,
  },
  amount: { fontSize: 23, color: C.ink, fontWeight: "800" },
  details: { alignItems: "flex-end", flexShrink: 1, marginLeft: 8 },
  description: {
    fontSize: 13,
    color: C.ink,
    fontWeight: "700",
    textAlign: "right",
  },
  meta: { fontSize: 10, color: C.muted, marginTop: 4 },
  rule: { height: 1, backgroundColor: C.line, marginBottom: 12 },
  actions: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  delete: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  deleteText: { color: C.coral, fontSize: 10, fontWeight: "700" },
  edit: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#EAF2EE",
  },
  editText: { color: C.green, fontSize: 10, fontWeight: "700" },
  confirm: {
    flex: 1,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: C.green,
  },
  confirmText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  manual: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    marginTop: 6,
  },
  manualText: { color: C.green, fontSize: 12, fontWeight: "700" },
  privacy: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 4 },
});

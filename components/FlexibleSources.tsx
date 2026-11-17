import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PAYMENT_SOURCES,
  listLaunchableApps,
  requestSmsPermission,
  setConfiguredNotificationApps,
  setNotificationSources,
  setSmsSenderSources,
} from "@/lib/notification-bridge";
import type {
  ConfiguredNotificationApp,
  LaunchableApp,
  SmsSenderSource,
} from "@/lib/notification-bridge";
import {
  addExpenseCategory,
  addPaymentMethod,
  loadExpenseCategories,
  loadPaymentMethods,
} from "@/lib/personalization";
import type { PaymentMethod } from "@/lib/personalization";
import type { ExpenseCategory } from "@/lib/categories";

const C = {
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  amber: "#D5A13D",
  paper: "#F7F5EF",
};
const NOTIFICATION_KEY = "masrofy.notification-sources.v1";
const APPS_KEY = "masrofy.notification-apps.v1";
const SMS_KEY = "masrofy.sms-senders.v1";
type SmsRow = SmsSenderSource & { enabled: boolean };

function stableId(value: string, prefix: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function safeArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function SelectRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#DADDD8", true: "#9BC8B8" }}
        thumbColor={value ? C.green : "#F8F8F6"}
      />
      <View style={s.rowText}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export default function FlexibleSources({
  bridgeAvailable,
}: {
  bridgeAvailable: boolean;
}) {
  const [builtIn, setBuiltIn] = useState<string[]>([]);
  const [apps, setApps] = useState<ConfiguredNotificationApp[]>([]);
  const [smsRows, setSmsRows] = useState<SmsRow[]>([]);
  const [installedApps, setInstalledApps] = useState<LaunchableApp[]>([]);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [appQuery, setAppQuery] = useState("");
  const [smsSender, setSmsSender] = useState("");
  const [smsLabel, setSmsLabel] = useState("");
  const [smsSourceId, setSmsSourceId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [methodName, setMethodName] = useState("");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  const syncSources = useCallback(
    async (
      nextBuiltIn: string[],
      nextApps: ConfiguredNotificationApp[],
      nextSms: SmsRow[],
    ) => {
      await AsyncStorage.setItem(NOTIFICATION_KEY, JSON.stringify(nextBuiltIn));
      await AsyncStorage.setItem(APPS_KEY, JSON.stringify(nextApps));
      await AsyncStorage.setItem(SMS_KEY, JSON.stringify(nextSms));
      await setNotificationSources(nextBuiltIn);
      await setConfiguredNotificationApps(nextApps);
      await setSmsSenderSources(nextSms.filter((row) => row.enabled));
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(NOTIFICATION_KEY),
      AsyncStorage.getItem(APPS_KEY),
      AsyncStorage.getItem(SMS_KEY),
      loadExpenseCategories(),
      loadPaymentMethods(),
    ]).then(async ([builtInValue, appValue, smsValue, nextCategories, nextMethods]) => {
      if (!active) return;
      const selected = safeArray<string>(builtInValue).filter((id) =>
        PAYMENT_SOURCES.some((item) => item.value === id),
      );
      const selectedApps = safeArray<ConfiguredNotificationApp>(appValue).filter(
        (item) =>
          typeof item.packageName === "string" &&
          typeof item.source === "string" &&
          typeof item.label === "string",
      );
      const selectedSms = safeArray<SmsRow>(smsValue).filter(
        (item) =>
          typeof item.sender === "string" &&
          typeof item.source === "string" &&
          typeof item.label === "string" &&
          typeof item.enabled === "boolean",
      );
      setBuiltIn(selected);
      setApps(selectedApps);
      setSmsRows(selectedSms);
      setCategories(nextCategories);
      setMethods(nextMethods);
      await setNotificationSources(selected);
      await setConfiguredNotificationApps(selectedApps);
      await setSmsSenderSources(selectedSms.filter((row) => row.enabled));
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredApps = useMemo(() => {
    const query = appQuery.trim().toLocaleLowerCase();
    return installedApps.filter(
      (app) =>
        !query ||
        app.label.toLocaleLowerCase().includes(query) ||
        app.packageName.toLocaleLowerCase().includes(query),
    );
  }, [installedApps, appQuery]);

  const toggleBuiltIn = async (id: string) => {
    const next = builtIn.includes(id)
      ? builtIn.filter((item) => item !== id)
      : [...builtIn, id];
    setBuiltIn(next);
    await syncSources(next, apps, smsRows);
  };

  const openApps = async () => {
    const available = await listLaunchableApps();
    if (!available.length) {
      Alert.alert(
        "قائمة التطبيقات غير متاحة",
        "هذه الميزة تحتاج إصدار Android مخصصًا ومحدّثًا. يمكنك الاستمرار بالمصادر المعروفة.",
      );
      return;
    }
    setInstalledApps(available);
    setAppQuery("");
    setShowAppPicker(true);
  };

  const toggleApp = async (app: LaunchableApp) => {
    const existing = apps.find((item) => item.packageName === app.packageName);
    const next = existing
      ? apps.filter((item) => item.packageName !== app.packageName)
      : [
          ...apps,
          {
            packageName: app.packageName,
            label: app.label,
            source: stableId(app.packageName, "app"),
          },
        ];
    if (!existing) {
      try {
        const source = stableId(app.packageName, "app");
        await addPaymentMethod(app.label, source);
        setMethods(await loadPaymentMethods());
      } catch (error) {
        Alert.alert("لم نتمكن من إضافة المصدر", error instanceof Error ? error.message : "حاول مرة أخرى.");
        return;
      }
    }
    setApps(next);
    await syncSources(builtIn, next, smsRows);
  };

  const addSmsSource = async () => {
    const sender = smsSender.trim();
    const label = smsLabel.trim() || sender;
    if (!sender || sender.length > 80 || sender.length < 2) {
      Alert.alert("مُعرّف المرسل", "اكتب اسم المرسل أو الرقم كما يظهر أعلى رسالة الدفع.");
      return;
    }
    if (smsRows.some((row) => row.sender.toLowerCase() === sender.toLowerCase())) {
      Alert.alert("مُعرّف موجود", "هذا المرسل مُضاف من قبل.");
      return;
    }
    const granted = await requestSmsPermission();
    if (!granted) {
      Alert.alert(
        "لم يُمنح إذن SMS",
        "لم يتم تفعيل مصدر الرسائل. على ColorOS قد تحتاج السماح بالإعدادات المقيدة للتطبيق يدويًا ثم المحاولة مرة أخرى.",
      );
      return;
    }
    const source = smsSourceId;
    if (!source || !methods.some((method) => method.id === source)) {
      Alert.alert("اختاري طريقة الدفع", "اربطي هذا المرسل بطريقة الدفع نفسها المستخدمة لإشعارات التطبيق.");
      return;
    }
    try {
      const linkedLabel = methods.find((method) => method.id === source)?.label ?? label;
      const next = [...smsRows, { sender, label: label || linkedLabel, source, enabled: true }];
      setSmsRows(next);
      setMethods(await loadPaymentMethods());
      setSmsSender("");
      setSmsLabel("");
      await syncSources(builtIn, apps, next);
    } catch (error) {
      Alert.alert("تعذر إضافة المرسل", error instanceof Error ? error.message : "حاول مرة أخرى.");
    }
  };

  const toggleSms = async (row: SmsRow) => {
    if (!row.enabled) {
      const granted = await requestSmsPermission();
      if (!granted) {
        Alert.alert("إذن SMS مطلوب", "لم يتم تشغيل هذا المرسل لأن الإذن لم يُمنح.");
        return;
      }
    }
    const next = smsRows.map((item) =>
      item.sender === row.sender ? { ...item, enabled: !item.enabled } : item,
    );
    setSmsRows(next);
    await syncSources(builtIn, apps, next);
  };

  const addCategory = async () => {
    try {
      const next = await addExpenseCategory(categoryName);
      setCategories(next);
      setCategoryName("");
    } catch (error) {
      Alert.alert("تعذر إضافة الفئة", error instanceof Error ? error.message : "حاول مرة أخرى.");
    }
  };

  const addMethod = async () => {
    try {
      const next = await addPaymentMethod(methodName);
      setMethods(next);
      setMethodName("");
    } catch (error) {
      Alert.alert("تعذر إضافة طريقة الدفع", error instanceof Error ? error.message : "حاول مرة أخرى.");
    }
  };

  return (
    <>
      <View style={s.section}>
        <View style={s.heading}>
          <View>
            <Text style={s.title}>مصادر الإشعارات</Text>
            <Text style={s.subtitle}>اختاري التطبيقات التي تريدين تتبع إشعاراتها فقط</Text>
          </View>
          <Ionicons name="apps-outline" size={20} color={C.green} />
        </View>
        {!bridgeAvailable ? (
          <Text style={s.note}>اختيار التطبيقات يحتاج إصدار Android مخصصًا يتضمن وحدة مصروفي.</Text>
        ) : null}
        {PAYMENT_SOURCES.map((item) => (
          <SelectRow
            key={item.value}
            title={item.label}
            subtitle="إشعارات التطبيق"
            value={builtIn.includes(item.value)}
            onValueChange={() => void toggleBuiltIn(item.value)}
            disabled={!bridgeAvailable}
          />
        ))}
        {apps.map((item) => (
          <SelectRow
            key={item.packageName}
            title={item.label}
            subtitle="تطبيق مخصص · الإشعارات فقط"
            value
            onValueChange={() => void toggleApp({ packageName: item.packageName, label: item.label })}
            disabled={!bridgeAvailable}
          />
        ))}
        <TouchableOpacity style={s.outlineButton} onPress={() => void openApps()} disabled={!bridgeAvailable}>
          <Ionicons name="add-circle-outline" size={18} color={C.green} />
          <Text style={s.outlineText}>اختيار تطبيق آخر من الهاتف</Text>
        </TouchableOpacity>
        <Text style={s.note}>Android يمنح إذن الوصول إلى الإشعارات للنظام، لكن مصروفي يفلتر محليًا ويعالج التطبيقات التي تختارينها فقط.</Text>
      </View>

      <View style={s.section}>
        <View style={s.heading}>
          <View>
            <Text style={s.title}>مرسلو رسائل SMS</Text>
            <Text style={s.subtitle}>الرسائل الجديدة من المرسلين الذين تضيفينهم فقط</Text>
          </View>
          <Ionicons name="chatbox-ellipses-outline" size={20} color={C.green} />
        </View>
        {smsRows.map((row) => (
          <SelectRow
            key={row.sender}
            title={row.label}
            subtitle={`المرسل: ${row.sender}`}
            value={row.enabled}
            onValueChange={() => void toggleSms(row)}
            disabled={!bridgeAvailable}
          />
        ))}
        <TextInput
          value={smsLabel}
          onChangeText={setSmsLabel}
          placeholder="اسم المصدر (مثال: محفظتي أو بنك WE)"
          placeholderTextColor="#9AA29C"
          style={s.input}
          textAlign="right"
          maxLength={40}
        />
        <TextInput
          value={smsSender}
          onChangeText={setSmsSender}
          placeholder="مُعرّف المرسل أو رقمه كما يظهر في SMS"
          placeholderTextColor="#9AA29C"
          style={s.input}
          textAlign="right"
          maxLength={80}
          autoCapitalize="none"
        />
        <Text style={s.methodPrompt}>اربط المرسل بطريقة الدفع نفسها للإشعار:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {methods.map((method) => (
            <TouchableOpacity
              key={method.id}
              onPress={() => setSmsSourceId(method.id)}
              style={[s.chip, smsSourceId === method.id && s.chipSelected]}
            >
              <Text style={[s.chipText, smsSourceId === method.id && s.chipTextSelected]}>
                {method.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.primaryButton} onPress={() => void addSmsSource()} disabled={!bridgeAvailable}>
          <Text style={s.primaryText}>إضافة مرسل SMS وطلب الإذن</Text>
        </TouchableOpacity>
        <Text style={s.warning}>الإذن حساس. لن يقرأ مصروفي سجل الرسائل القديم، ولن يحفظ نص الرسالة أو يرسله؛ سيحلل الرسائل الجديدة فقط محليًا. قد تخضع صلاحية SMS لمراجعة Google Play.</Text>
      </View>

      <View style={s.section}>
        <View style={s.heading}>
          <View>
            <Text style={s.title}>طرق الدفع اليدوية</Text>
            <Text style={s.subtitle}>تظهر هذه الأسماء عند تسجيل «صرفت»</Text>
          </View>
          <Ionicons name="wallet-outline" size={20} color={C.green} />
        </View>
        {methods.map((method) => (
          <Text key={method.id} style={s.simpleItem}>{method.label}</Text>
        ))}
        <View style={s.inputRow}>
          <TouchableOpacity style={s.addSmall} onPress={() => void addMethod()}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
          <TextInput value={methodName} onChangeText={setMethodName} placeholder="اسم طريقة دفع جديدة" placeholderTextColor="#9AA29C" style={[s.input, { flex: 1 }]} textAlign="right" maxLength={40} />
        </View>
      </View>

      <View style={s.section}>
        <View style={s.heading}>
          <View>
            <Text style={s.title}>فئات مخصصة</Text>
            <Text style={s.subtitle}>أضيفي تصنيفًا يناسب مصروفاتك</Text>
          </View>
          <Ionicons name="pricetag-outline" size={20} color={C.green} />
        </View>
        {categories.map((category) => (
          <Text key={category.id} style={s.simpleItem}>{category.label}</Text>
        ))}
        <View style={s.inputRow}>
          <TouchableOpacity style={s.addSmall} onPress={() => void addCategory()}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
          <TextInput value={categoryName} onChangeText={setCategoryName} placeholder="اسم فئة جديدة" placeholderTextColor="#9AA29C" style={[s.input, { flex: 1 }]} textAlign="right" maxLength={40} />
        </View>
      </View>

      <Modal visible={showAppPicker} animationType="slide" onRequestClose={() => setShowAppPicker(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowAppPicker(false)}><Text style={s.closeText}>إغلاق</Text></TouchableOpacity>
            <Text style={s.title}>اختاري تطبيق الإشعارات</Text>
          </View>
          <TextInput value={appQuery} onChangeText={setAppQuery} placeholder="ابحثي عن تطبيق" placeholderTextColor="#9AA29C" style={s.input} textAlign="right" />
          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            renderItem={({ item }) => {
              const selected = apps.some((app) => app.packageName === item.packageName);
              return (
                <SelectRow
                  title={item.label}
                  subtitle={item.packageName}
                  value={selected}
                  onValueChange={() => void toggleApp(item)}
                />
              );
            }}
            ListEmptyComponent={<Text style={s.note}>لا توجد تطبيقات مطابقة.</Text>}
          />
          <Text style={s.note}>فعّلي التطبيق هنا فقط إذا كان مصدرًا للدفع؛ لا نقرأ إشعارات التطبيقات الأخرى.</Text>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: "#fff", borderRadius: 20, padding: 15, marginBottom: 14 },
  heading: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { color: C.ink, fontSize: 13, fontWeight: "800", textAlign: "right" },
  subtitle: { color: C.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  row: { minHeight: 58, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderTopColor: C.line, borderTopWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, alignItems: "flex-end" },
  rowTitle: { color: C.ink, fontSize: 12, fontWeight: "700", textAlign: "right" },
  rowSub: { color: C.muted, fontSize: 9, marginTop: 3, textAlign: "right" },
  input: { minHeight: 44, borderRadius: 12, backgroundColor: C.paper, marginTop: 8, paddingHorizontal: 12, color: C.ink, fontSize: 11 },
  inputRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  addSmall: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center", marginTop: 8 },
  outlineButton: { minHeight: 42, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: C.green, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  outlineText: { color: C.green, fontSize: 11, fontWeight: "800" },
  primaryButton: { height: 43, marginTop: 8, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  note: { color: C.muted, fontSize: 9, lineHeight: 15, textAlign: "right", marginTop: 9 },
  warning: { color: "#796126", fontSize: 9, lineHeight: 15, textAlign: "right", marginTop: 10, backgroundColor: "#FBF3DF", borderRadius: 11, padding: 10 },
  simpleItem: { textAlign: "right", color: C.ink, fontSize: 11, paddingVertical: 5 },
  methodPrompt: { color: C.muted, fontSize: 10, textAlign: "right", marginTop: 9 },
  chips: { flexDirection: "row-reverse", gap: 7, paddingVertical: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff" },
  chipSelected: { borderColor: C.green, backgroundColor: "#E8F1EC" },
  chipText: { color: C.muted, fontSize: 9 },
  chipTextSelected: { color: C.green, fontWeight: "800" },
  modal: { flex: 1, backgroundColor: C.paper, paddingTop: 50, paddingHorizontal: 18, paddingBottom: 20 },
  modalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  closeText: { color: C.green, fontWeight: "700", fontSize: 12 },
});

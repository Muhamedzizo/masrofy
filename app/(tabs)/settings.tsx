import { useCallback, useState } from "react";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import FlexibleSources from "@/components/FlexibleSources";
import {
  getNotificationAccessEnabled,
  openNotificationAccessSettings,
} from "@/lib/notification-bridge";
const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  white: "#FFFFFF",
  amber: "#D5A13D",
};
function hasNativeListener(): boolean {
  try {
    return Boolean(
      requireOptionalNativeModule<Record<string, unknown>>(
        "MasrofyNotifications",
      ),
    );
  } catch {
    return false;
  }
}
export default function SettingsScreen() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const supported = Platform.OS === "android";
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const available = supported && hasNativeListener();
      setBridgeAvailable(available);
      if (available) {
        setEnabled(await getNotificationAccessEnabled());
      }
      else setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const openSettings = async () => {
    await openNotificationAccessSettings();
    setTimeout(() => {
      void getNotificationAccessEnabled().then(setEnabled);
    }, 700);
  };
  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>تفضيلاتك وخصوصيتك</Text>
            <Text style={s.title}>الإعدادات</Text>
          </View>
          <View style={s.logo}>
            <Ionicons name="settings-outline" size={21} color={C.green} />
          </View>
        </View>
        <View style={s.privacyCard}>
          <View style={s.privacyMark}>
            <Ionicons name="lock-closed" size={20} color={C.green} />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={s.privacyTitle}>دفترك ملكك</Text>
            <Text style={s.privacyText}>
              دفترك الشخصي محفوظ على جهازك فقط. دفتر الأسرة اختياري ومشترك مع الأعضاء الذين تدعوهم، ويُحفظ على الخادم.
            </Text>
          </View>
        </View>
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.statusWrap}>
              <View
                style={[
                  s.statusDot,
                  { backgroundColor: enabled ? C.green : C.amber },
                ]}
              />
              <Text
                style={[s.statusText, { color: enabled ? C.green : "#8A681F" }]}
              >
                {loading
                  ? "جارٍ الفحص"
                  : !supported || !bridgeAvailable
                    ? "غير مدعوم"
                    : enabled
                      ? "مفعّل"
                      : "غير مفعّل"}
              </Text>
            </View>
            <View>
              <Text style={s.sectionTitle}>التقاط إشعارات الدفع</Text>
              <Text style={s.sectionSub}>
                صلاحية Android NotificationListener
              </Text>
            </View>
          </View>
          {!supported || !bridgeAvailable ? (
            <View style={s.unsupported}>
              <Ionicons
                name="phone-portrait-outline"
                size={19}
                color="#8E711F"
              />
              <Text style={s.unsupportedText}>
                {!supported
                  ? "الالتقاط غير مدعوم على هذه المنصة. يعمل على بناء Android مخصص فقط؛ معاينة الويب لا تصل لإشعارات الهاتف."
                  : "خدمة التقاط Android غير موجودة في هذا البناء. استخدم إصدار Android مخصصًا يتضمن وحدة مصروفي؛ Expo Go والمعاينة لا يلتقطان الإشعارات."}
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.explain}>
                بعد تفعيل الصلاحية، يقترح مصروفي عمليات الدفع الجديدة من المصادر
                المختارة. كل عملية تفضل معلّقة لحد ما تراجعها بنفسك.
              </Text>
              <TouchableOpacity
                onPress={() => void openSettings()}
                style={s.permissionButton}
              >
                <Ionicons name="open-outline" size={18} color="#fff" />
                <Text style={s.permissionText}>
                  {enabled ? "إدارة صلاحية الإشعارات" : "فتح إعدادات الإشعارات"}
                </Text>
              </TouchableOpacity>
              <Text style={s.permissionFoot}>
                هتفتح إعدادات أندرويد. فعّل «مصروفي» من الوصول إلى الإشعارات ثم
                ارجع للتطبيق.
              </Text>
            </>
          )}
        </View>
        <FlexibleSources bridgeAvailable={bridgeAvailable} />
        <TouchableOpacity
          style={s.reviewLink}
          onPress={() => router.push("/review")}
        >
          <View style={s.reviewIcon}>
            <Ionicons name="eye-outline" size={18} color={C.green} />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={s.linkTitle}>مراجعة العمليات</Text>
            <Text style={s.linkSub}>
              الاقتراحات لا تدخل الإجماليات إلا بعد تأكيدك
            </Text>
          </View>
          <Ionicons name="chevron-back" size={18} color={C.muted} />
        </TouchableOpacity>
        <View style={s.footer}>
          <Text style={s.version}>مصروفي · دفتر شخصي أو أسري اختياري</Text>
          <Text style={s.versionSub}>نص إشعار الدفع ورسالة SMS الأصلية لا يُحفظان</Text>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 35 },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  kicker: { color: C.muted, textAlign: "right", fontSize: 11 },
  title: {
    fontSize: 23,
    color: C.ink,
    textAlign: "right",
    fontWeight: "800",
    marginTop: 3,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#E7F0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyCard: {
    backgroundColor: "#E8F1EC",
    borderRadius: 19,
    padding: 14,
    flexDirection: "row-reverse",
    gap: 11,
    alignItems: "flex-start",
    marginBottom: 20,
  },
  privacyMark: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#D7E9E0",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyTitle: {
    fontSize: 13,
    color: C.ink,
    fontWeight: "800",
    textAlign: "right",
  },
  privacyText: {
    fontSize: 11,
    color: "#50645C",
    lineHeight: 17,
    textAlign: "right",
    marginTop: 4,
  },
  section: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 15,
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  sectionSub: {
    color: C.muted,
    fontSize: 10,
    textAlign: "right",
    marginTop: 3,
  },
  statusWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F7F5EF",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 11,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "800" },
  explain: {
    color: "#56645D",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "right",
    marginBottom: 13,
  },
  permissionButton: {
    height: 44,
    backgroundColor: C.green,
    borderRadius: 13,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  permissionText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  permissionFoot: {
    color: C.muted,
    fontSize: 9,
    lineHeight: 15,
    textAlign: "right",
    marginTop: 8,
  },
  unsupported: {
    backgroundColor: "#FBF3DF",
    borderRadius: 13,
    padding: 11,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 7,
  },
  unsupportedText: {
    flex: 1,
    color: "#796126",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "right",
  },
  sourceRow: {
    minHeight: 58,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
    borderTopColor: C.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sourceToggle: { minWidth: 44, alignItems: "flex-start" },
  sourceInfo: { flex: 1, alignItems: "flex-end" },
  sourceLabel: { color: C.ink, fontSize: 12, fontWeight: "700" },
  sourceHint: { color: C.muted, fontSize: 10, marginTop: 3 },
  sourceIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F0F3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  smsNote: {
    flexDirection: "row-reverse",
    gap: 7,
    alignItems: "flex-start",
    backgroundColor: "#FBF5E8",
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  smsText: {
    flex: 1,
    color: "#776432",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "right",
  },
  reviewLink: {
    backgroundColor: C.white,
    borderRadius: 17,
    padding: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  reviewIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#E7F0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: { color: C.ink, fontSize: 12, fontWeight: "800" },
  linkSub: { color: C.muted, fontSize: 9, marginTop: 3, textAlign: "right" },
  footer: { alignItems: "center", paddingVertical: 22 },
  version: { color: C.muted, fontSize: 10, fontWeight: "700" },
  versionSub: { color: "#A1A9A4", fontSize: 9, marginTop: 4 },
});

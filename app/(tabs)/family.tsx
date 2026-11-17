import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

const C = {
  paper: "#F7F5EF",
  green: "#0F766E",
  ink: "#182423",
  muted: "#77817C",
  line: "#E8E5DC",
  white: "#FFFFFF",
  coral: "#C65F47",
  mint: "#E6F1EE",
};
const errText = (error: unknown) =>
  error instanceof Error ? error.message : "حدث خطأ غير متوقع";
const amountText = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n)
    ? new Intl.NumberFormat("ar-EG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n)
    : "—";
};
const dateText = (value: unknown) => {
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ar-EG");
};

export default function FamilyScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const [name, setName] = useState("");
  const [manualToken, setManualToken] = useState("");
  const routeToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = routeToken ?? manualToken;
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [inviteToken, setInviteToken] = useState("");
  const [loginError, setLoginError] = useState("");

  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const loggedIn = Boolean(me.data);
  const families = trpc.family.listMine.useQuery(undefined, {
    enabled: loggedIn,
    retry: false,
  });
  const selected =
    families.data?.find((x) => x.family.id === selectedId) ??
    families.data?.[0];
  const familyId = selected?.family.id;
  const owner = selected?.family.ownerUserId === me.data?.id;
  const canAdd = owner || Boolean(selected?.membership.canAdd);
  const entries = trpc.family.listEntries.useQuery(
    { familyId: familyId ?? 0, limit: 100 },
    {
      enabled: Boolean(
        loggedIn && familyId && (owner || selected?.membership.canView),
      ),
      retry: false,
    },
  );
  const members = trpc.family.listMembers.useQuery(
    { familyId: familyId ?? 0 },
    { enabled: Boolean(loggedIn && owner && familyId), retry: false },
  );
  const invitations = trpc.family.listInvitations.useQuery(
    { familyId: familyId ?? 0 },
    { enabled: Boolean(loggedIn && owner && familyId), retry: false },
  );
  const utils = trpc.useUtils();
  const refresh = async () => {
    await Promise.all([
      utils.family.listMine.invalidate(),
      utils.family.listEntries.invalidate(),
      utils.family.listMembers.invalidate(),
      utils.family.listInvitations.invalidate(),
    ]);
  };
  const createFamily = trpc.family.create.useMutation({
    onSuccess: async () => {
      setName("");
      await refresh();
    },
    onError: (e) => Alert.alert("تعذر إنشاء الدفتر", e.message),
  });
  const accept = trpc.family.acceptInvitation.useMutation({
    onSuccess: async () => {
      setManualToken("");
      await refresh();
      Alert.alert("تم", "أصبحت عضوًا في دفتر الأسرة.");
    },
    onError: (e) => Alert.alert("تعذر قبول الدعوة", e.message),
  });
  const addExpense = trpc.family.addExpense.useMutation({
    onSuccess: async () => {
      setAmount("");
      setDescription("");
      await refresh();
    },
    onError: (e) => Alert.alert("تعذر تسجيل المصروف", e.message),
  });
  const addAllowance = trpc.family.addAllowance.useMutation({
    onSuccess: async () => {
      setAmount("");
      setDescription("");
      await refresh();
    },
    onError: (e) => Alert.alert("تعذر تسجيل المبلغ", e.message),
  });
  const revokeInvite = trpc.family.revokeInvitation.useMutation({
    onSuccess: async () => {
      await utils.family.listInvitations.invalidate();
    },
    onError: (e) => Alert.alert("تعذر إلغاء الدعوة", e.message),
  });
  const createInvite = trpc.family.createInvitation.useMutation({
    onSuccess: async (result) => {
      setInviteToken(result.token);
      setEmail("");
      await utils.family.listInvitations.invalidate();
      try {
        const url = Linking.createURL("/family", {
          queryParams: { token: result.token },
        });
        await Share.share({
          message: `دعوة للانضمام إلى دفتر الأسرة في مصروفي. سجّل الدخول إلى حساب Manus المطابق للبريد المدعو، ثم افتح الرابط: ${url}`,
          url,
        });
      } catch {
        Alert.alert(
          "تعذرت المشاركة",
          "انسخ رمز الدعوة وشاركه يدويًا؛ لم يُرسل بريد.",
        );
      }
    },
    onError: (e) => Alert.alert("تعذر إنشاء الدعوة", e.message),
  });

  const total = useMemo(
    () =>
      (entries.data ?? []).reduce(
        (sum, row) =>
          row.entry.type === "expense"
            ? sum + (Number(row.entry.amount) || 0)
            : sum,
        0,
      ),
    [entries.data],
  );
  const membersForAllowance = members.data ?? [];
  const selectedMember = membersForAllowance.find(
    (m) => m.userId !== me.data?.id,
  );
  const apiError = [
    families.error,
    entries.error,
    members.error,
    invitations.error,
  ].find(Boolean);

  if (me.isLoading)
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.green} />
        <Text style={s.muted}>جارٍ التحقق من تسجيل الدخول…</Text>
      </View>
    );
  if (me.error && !loggedIn)
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Header />
        <View style={s.errorBox}>
          <Text style={s.error}>تعذر التحقق من الجلسة أو تهيئة API.</Text>
          <Text style={s.errorSmall}>{errText(me.error)}</Text>
          <Button
            label="إعادة المحاولة"
            onPress={() => {
              void me.refetch();
            }}
            secondary
          />
        </View>
      </ScrollView>
    );
  if (!loggedIn)
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Header />
        <Card>
          <Text style={s.title}>دفتر الأسرة</Text>
          <Text style={s.copy}>
            سجّل الدخول بحساب Manus لعرض دفاتر الأسرة وقبول الدعوات.
          </Text>
          <Button
            label="تسجيل الدخول"
            onPress={async () => {
              try {
                await startOAuthLogin();
              } catch (e) {
                setLoginError(errText(e));
              }
            }}
          />
          {loginError ? <Text style={s.error}>{loginError}</Text> : null}
          <Text style={s.note}>
            بعد تسجيل الدخول، افتح رابط الدعوة مرة ثانية لقبولها.
          </Text>
        </Card>
      </ScrollView>
    );

  return (
    <ScrollView
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Header />
      {!!apiError && (
        <View style={s.errorBox}>
          <Text style={s.error}>
            تعذر الاتصال بخدمة دفتر الأسرة أو لا تملك صلاحية لهذا العرض.
          </Text>
          <Text style={s.errorSmall}>{errText(apiError)}</Text>
          <Button
            label="إعادة المحاولة"
            onPress={() => {
              void refresh();
              void families.refetch();
            }}
            secondary
          />
        </View>
      )}
      {token.trim().length > 0 && (
        <Card>
          <Text style={s.title}>قبول دعوة الأسرة</Text>
          <Text style={s.copy}>
            يجب تسجيل الدخول بالبريد الذي وُجهت إليه الدعوة.
          </Text>
          <Input
            value={token}
            onChangeText={setManualToken}
            placeholder="رمز الدعوة"
            autoCapitalize="none"
          />
          <Button
            label="قبول الدعوة"
            loading={accept.isPending}
            onPress={() => accept.mutate({ token: token.trim() })}
          />
        </Card>
      )}
      <Card>
        <Text style={s.title}>إنشاء دفتر أسرة</Text>
        <Input value={name} onChangeText={setName} placeholder="اسم الدفتر" />
        <Button
          label="إنشاء دفتر"
          loading={createFamily.isPending}
          onPress={() => {
            if (name.trim()) createFamily.mutate({ name: name.trim() });
          }}
        />
      </Card>
      {families.isLoading ? <ActivityIndicator color={C.green} /> : null}
      {!!families.data?.length && (
        <>
          <Text style={s.section}>دفاتري</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
          >
            {families.data.map((item) => (
              <TouchableOpacity
                key={item.family.id}
                onPress={() => setSelectedId(item.family.id)}
                style={[
                  s.chip,
                  selected?.family.id === item.family.id && s.chipOn,
                ]}
              >
                <Text
                  style={[
                    s.chipText,
                    selected?.family.id === item.family.id && s.chipTextOn,
                  ]}
                >
                  {item.family.name}
                  {item.family.ownerUserId === me.data?.id ? " · المالك" : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selected && (
            <>
              <Card style={s.summary}>
                <Text style={s.title}>{selected.family.name}</Text>
                <Text style={s.copy}>
                  إجمالي المصروفات المسجلة:{" "}
                  <Text style={s.total}>{amountText(total)} ج.م</Text>
                </Text>
                <Text style={s.note}>لا تشمل المبالغ المصروفة/المعطاة.</Text>
              </Card>
              {canAdd && (
                <Card>
                  <Text style={s.title}>تسجيل مصروف أسري</Text>
                  <Input
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="المبلغ بالجنيه"
                    keyboardType="decimal-pad"
                  />
                  <Input
                    value={description}
                    onChangeText={setDescription}
                    placeholder="الوصف (اختياري)"
                  />
                  <Button
                    label="تسجيل مصروف"
                    loading={addExpense.isPending}
                    onPress={() => {
                      const n = Number(amount.replace(",", "."));
                      if (Number.isFinite(n) && n > 0 && familyId)
                        addExpense.mutate({
                          familyId,
                          amount: n,
                          occurredAt: new Date(),
                          description: description.trim() || undefined,
                        });
                      else
                        Alert.alert(
                          "تحقق من المبلغ",
                          "أدخل مبلغًا أكبر من صفر.",
                        );
                    }}
                  />
                </Card>
              )}
              {owner && selectedMember && (
                <Card>
                  <Text style={s.title}>تسجيل مبلغ معطى</Text>
                  <Text style={s.copy}>
                    المالك فقط؛ اختر المستلم من قائمة الأعضاء.
                  </Text>
                  <View style={s.memberPicker}>
                    {membersForAllowance
                      .filter((m) => m.userId !== me.data?.id)
                      .map((m) => (
                        <TouchableOpacity
                          key={m.userId}
                          onPress={() => setRecipientId(m.userId)}
                          style={[s.chip, recipientId === m.userId && s.chipOn]}
                        >
                          <Text
                            style={[
                              s.chipText,
                              recipientId === m.userId && s.chipTextOn,
                            ]}
                          >
                            {m.name || m.email || `عضو ${m.userId}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                  <Input
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="المبلغ بالجنيه"
                    keyboardType="decimal-pad"
                  />
                  <Input
                    value={description}
                    onChangeText={setDescription}
                    placeholder="الوصف (اختياري)"
                  />
                  <Button
                    label="تسجيل المبلغ المعطى"
                    loading={addAllowance.isPending}
                    onPress={() => {
                      const n = Number(amount.replace(",", "."));
                      const recipientUserId =
                        recipientId &&
                        membersForAllowance.some(
                          (m) => m.userId === recipientId,
                        )
                          ? recipientId
                          : selectedMember.userId;
                      if (Number.isFinite(n) && n > 0 && familyId)
                        addAllowance.mutate({
                          familyId,
                          recipientUserId,
                          amount: n,
                          occurredAt: new Date(),
                          description: description.trim() || undefined,
                        });
                      else
                        Alert.alert(
                          "تحقق من المبلغ",
                          "أدخل مبلغًا أكبر من صفر.",
                        );
                    }}
                  />
                </Card>
              )}
              <Text style={s.section}>سجل الدفتر</Text>
              {entries.isLoading ? (
                <ActivityIndicator color={C.green} />
              ) : !entries.data?.length ? (
                <Card>
                  <Text style={s.copy}>لا توجد عمليات مسجلة بعد.</Text>
                </Card>
              ) : (
                entries.data.map((row) => (
                  <View key={row.entry.id} style={s.entry}>
                    <View
                      style={[
                        s.entryIcon,
                        row.entry.type === "allowance" && s.allowanceIcon,
                      ]}
                    >
                      <Ionicons
                        name={
                          row.entry.type === "allowance"
                            ? "gift-outline"
                            : "cart-outline"
                        }
                        size={19}
                        color={
                          row.entry.type === "allowance" ? "#8D661A" : C.green
                        }
                      />
                    </View>
                    <View style={s.entryBody}>
                      <Text style={s.entryTitle}>
                        {row.entry.description ||
                          (row.entry.type === "allowance"
                            ? "مبلغ معطى"
                            : "مصروف أسري")}
                      </Text>
                      <Text style={s.note}>
                        {row.entry.type === "allowance"
                          ? "مصروف معطى"
                          : "مصروف"}{" "}
                        · {row.authorName || "عضو"} ·{" "}
                        {dateText(row.entry.occurredAt)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        s.entryAmount,
                        row.entry.type === "allowance" && s.allowanceAmount,
                      ]}
                    >
                      {amountText(row.entry.amount)} ج.م
                    </Text>
                  </View>
                ))
              )}
              {owner && (
                <>
                  <Text style={s.section}>إدارة الأسرة</Text>
                  <Card>
                    <Text style={s.title}>دعوة عضو بالبريد</Text>
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      placeholder="البريد الإلكتروني"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Button
                      label="إنشاء رابط دعوة ومشاركته"
                      loading={createInvite.isPending}
                      onPress={() => {
                        if (familyId && email.trim())
                          createInvite.mutate({
                            familyId,
                            email: email.trim(),
                          });
                      }}
                    />
                    {inviteToken ? (
                      <Text selectable style={s.note}>
                        رمز الدعوة لمرة واحدة: {inviteToken}
                      </Text>
                    ) : null}
                    <Text style={s.note}>
                      لا يُرسل بريد إلكتروني؛ تتم المشاركة عبر نافذة مشاركة
                      الجهاز.
                    </Text>
                  </Card>
                  <Text style={s.subsection}>الأعضاء والصلاحيات</Text>
                  {membersForAllowance.map((m) => (
                    <MemberRow
                      key={m.userId}
                      member={m}
                      familyId={familyId!}
                      ownerId={me.data!.id}
                      refresh={refresh}
                    />
                  ))}
                  <Text style={s.subsection}>دعوات معلقة</Text>
                  {!invitations.data?.length ? (
                    <Text style={s.note}>لا توجد دعوات معلقة.</Text>
                  ) : (
                    invitations.data.map((inv) => (
                      <View key={inv.id} style={s.inviteRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.entryTitle}>{inv.email}</Text>
                          <Text style={s.note}>
                            تنتهي {dateText(inv.expiresAt)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              "إلغاء الدعوة؟",
                              "لن يعود الرمز صالحًا.",
                              [
                                { text: "تراجع", style: "cancel" },
                                {
                                  text: "إلغاء",
                                  style: "destructive",
                                  onPress: async () => {
                                    revokeInvite.mutate({
                                      familyId: familyId!,
                                      invitationId: inv.id,
                                    });
                                  },
                                },
                              ],
                            )
                          }
                        >
                          <Text style={s.remove}>إلغاء</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {!families.isLoading && !families.data?.length && (
        <Text style={s.note}>
          أنشئ دفترًا أو سجّل الدخول عبر رابط دعوة للبدء.
        </Text>
      )}
    </ScrollView>
  );
}

function Header() {
  return (
    <View style={s.header}>
      <View>
        <Text style={s.eyebrow}>مصروفي · مساحة مشتركة</Text>
        <Text style={s.brand}>دفتر الأسرة</Text>
      </View>
      <View style={s.headerIcon}>
        <Ionicons name="people" size={21} color={C.green} />
      </View>
    </View>
  );
}
function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#9AA39E"
      style={s.input}
      textAlign="right"
    />
  );
}
function Button({
  label,
  onPress,
  loading,
  secondary,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={loading}
      onPress={onPress}
      style={[s.button, secondary && s.buttonSecondary]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? C.green : "white"} />
      ) : (
        <Text style={[s.buttonText, secondary && s.buttonTextSecondary]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
function MemberRow({
  member,
  familyId,
  ownerId,
  refresh,
}: {
  member: {
    userId: number;
    name: string | null;
    email: string | null;
    canView: boolean;
    canAdd: boolean;
    canEditOwn: boolean;
  };
  familyId: number;
  ownerId: number;
  refresh: () => Promise<void>;
}) {
  const [v, setV] = useState(member.canView),
    [a, setA] = useState(member.canAdd),
    [e, setE] = useState(member.canEditOwn);
  const utils = trpc.useUtils();
  const perms = trpc.family.setMemberPermissions.useMutation({
    onSuccess: async () => {
      await refresh();
    },
    onError: (er) => Alert.alert("تعذر حفظ الصلاحيات", er.message),
  });
  const remove = trpc.family.removeMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.family.listMembers.invalidate(),
        utils.family.listMine.invalidate(),
      ]);
    },
    onError: (er) => Alert.alert("تعذرت إزالة العضو", er.message),
  });
  const toggle = (
    label: string,
    val: boolean,
    set: (x: boolean) => void,
    key: "canView" | "canAdd" | "canEditOwn",
  ) => (
    <TouchableOpacity
      onPress={() => {
        const next = !val;
        set(next);
        perms.mutate({
          familyId,
          userId: member.userId,
          canView: key === "canView" ? next : v,
          canAdd: key === "canAdd" ? next : a,
          canEditOwn: key === "canEditOwn" ? next : e,
        });
      }}
      style={s.permission}
    >
      <Text style={s.permissionText}>{label}</Text>
      <Ionicons
        name={val ? "checkbox" : "square-outline"}
        size={20}
        color={val ? C.green : C.muted}
      />
    </TouchableOpacity>
  );
  return (
    <View style={s.memberCard}>
      <View style={s.memberHead}>
        <Text style={s.entryTitle}>
          {member.name || member.email || `عضو ${member.userId}`}
          {member.userId === ownerId ? " · المالك" : ""}
        </Text>
        {member.userId !== ownerId && (
          <TouchableOpacity
            onPress={() =>
              Alert.alert("إزالة العضو؟", "سيفقد الوصول إلى دفتر الأسرة.", [
                { text: "تراجع", style: "cancel" },
                {
                  text: "إزالة",
                  style: "destructive",
                  onPress: () =>
                    remove.mutate({ familyId, userId: member.userId }),
                },
              ])
            }
          >
            <Text style={s.remove}>إزالة</Text>
          </TouchableOpacity>
        )}
      </View>
      {member.userId !== ownerId && (
        <View style={s.permissions}>
          {toggle("عرض الدفتر", v, setV, "canView")}
          {toggle("إضافة مصروف", a, setA, "canAdd")}
          {toggle("تعديل مصروفه", e, setE, "canEditOwn")}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  content: { padding: 18, paddingBottom: 50, backgroundColor: C.paper },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.paper,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  eyebrow: { textAlign: "right", fontSize: 11, color: C.muted },
  brand: {
    textAlign: "right",
    fontSize: 25,
    fontWeight: "800",
    color: C.ink,
    marginTop: 3,
  },
  headerIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#F0EEE8",
  },
  summary: { backgroundColor: C.green },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    textAlign: "right",
    marginBottom: 9,
  },
  copy: {
    fontSize: 13,
    lineHeight: 21,
    color: C.muted,
    textAlign: "right",
    marginBottom: 7,
  },
  total: { fontWeight: "800", color: C.ink },
  note: {
    fontSize: 11,
    color: C.muted,
    textAlign: "right",
    marginTop: 7,
    lineHeight: 17,
  },
  muted: { fontSize: 13, color: C.muted },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingHorizontal: 13,
    marginTop: 8,
    marginBottom: 2,
    color: C.ink,
    backgroundColor: "#FCFBF8",
    fontSize: 14,
  },
  button: {
    minHeight: 45,
    borderRadius: 13,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 11,
  },
  buttonText: { color: "white", fontWeight: "800", fontSize: 13 },
  buttonSecondary: { backgroundColor: C.mint },
  buttonTextSecondary: { color: C.green },
  section: {
    textAlign: "right",
    fontSize: 17,
    fontWeight: "800",
    color: C.ink,
    marginTop: 13,
    marginBottom: 10,
  },
  subsection: {
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
    color: C.ink,
    marginTop: 14,
    marginBottom: 8,
  },
  chips: { flexDirection: "row-reverse", gap: 8, paddingBottom: 10 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipText: { fontSize: 12, color: C.ink, fontWeight: "700" },
  chipTextOn: { color: "white" },
  memberPicker: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 7,
    marginVertical: 8,
  },
  entry: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  entryIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  allowanceIcon: { backgroundColor: "#FBF2DC" },
  entryBody: { flex: 1, alignItems: "flex-end" },
  entryTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.ink,
    textAlign: "right",
  },
  entryAmount: { fontSize: 12, fontWeight: "800", color: C.coral },
  allowanceAmount: { color: "#8D661A" },
  errorBox: {
    backgroundColor: "#FCEDEA",
    borderColor: "#E9C3BA",
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  error: {
    textAlign: "right",
    fontSize: 13,
    color: "#A53F2B",
    fontWeight: "700",
  },
  errorSmall: {
    textAlign: "right",
    fontSize: 11,
    color: "#A53F2B",
    marginTop: 6,
  },
  memberCard: {
    backgroundColor: C.white,
    borderRadius: 15,
    padding: 12,
    marginBottom: 8,
  },
  memberHead: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  remove: { color: C.coral, fontSize: 12, fontWeight: "800" },
  permissions: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 10,
  },
  permission: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
  },
  permissionText: { fontSize: 11, color: C.muted },
  inviteRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: C.white,
    borderRadius: 14,
    marginBottom: 7,
  },
});

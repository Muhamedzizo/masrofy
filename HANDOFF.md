# سجل تسليم «مصروفي» — مشروع Manus Mobile الجديد

## المشروع الحالي

- مورد Manus: `manus-resource://manus-webdev/project/wdp_f0cf7a04b580ecdda45a9df9`
- مجلد المشروع: `/home/ubuntu/masrofy3`
- أُنشئ المشروع من ملفات المصدر المرفقة بعد تعذر ربط المورد السابق. وافق المستخدم على النسخة الجديدة، وبقي المشروع السابق دون تعديل.
- النوع Manus Mobile (Expo/React Native). اسم التطبيق «مصروفي»، slug: `masrofy3`، ومعرّف Android: `space.manus.masrofy3.t132338731190769`.
- `publishing.auto_publish=false`؛ لا يُنشر التطبيق للعامة. الغرض هو بناء APK عبر **Build APK** في لوحة Manus.

## المنتج والخصوصية

تطبيق مصروفات Android عربي لمستخدم واحد. يدعم الإدخال اليدوي، السجل والملخصات والفلاتر والفئات، وصندوق مراجعة مستقل لاقتراحات مستخرجة من إشعارات InstaPay وAna Vodafone/Vodafone Cash وmyFawry. تخزين معاملات المستخدم محليًا: SQLite على Android وAsyncStorage منفصل لمعاينة الويب. لا تستخدم شاشات التطبيق خادم/قاعدة Manus لحفظ المصروفات، ولا توجد مزامنة أو مشاركة أو حساب مستخدم. مصادر الإشعارات متوقفة افتراضيًا، ولا يُحفظ نص الإشعار الخام. الاستخلاص heuristic وليس تكاملًا رسميًا مضمونًا؛ التطبيق لا يقرأ SMS.

## الفحوص المنفذة في النسخة الجديدة — 2026-11-16

- `CI=true pnpm check`: نجح.
- `CI=true pnpm test`: 34 اختبارًا ناجحًا، واختبار واحد متخطّى (`tests/auth.logout.test.ts`).
- `CI=true pnpm lint`: نجح مع تحذير Node غير مانع عن نوع ESM في `eslint.config.js`.
- `pnpm exec expo config --type prebuild --json`: أكد الاسم والـslug ومعرّف Android والرابط الدائم للشعار والأيقونات.
- `CI=true pnpm exec expo prebuild --platform android --no-install`: نجح.
- `expo-modules-autolinking resolve --platform android --json`: وجد وحدة `masrofy-notifications` المحلية.
- AndroidManifest الناتج يسجل `MasrofyNotificationListenerService` مع `BIND_NOTIFICATION_LISTENER_SERVICE` والـaction الصحيح، ويحافظ على `allowBackup=false`؛ ولا يتضمن `READ_SMS` أو `RECEIVE_SMS`.
- Metro أعاد HTTP 200. عُرضت صفحات الملخص والسجل والإعدادات والمراجعة على مقاس هاتف 390×844.

## ما يزال مفتوحًا

- لم يُبنَ APK/AAB بعد. يجب استخدام إجراء **Build APK** في لوحة Manus بعد حفظ نسخة المصدر. لا تتوفر في Sandbox أدوات Android SDK لبناء إصدار أصلي محليًا.
- لم يُختبر APK على هاتف حقيقي. يظل تثبيت التطبيق وصلاحية NotificationListener ومصادر الإشعارات والإشعارات الصادرة الناجحة والفاشلة/الواردة مفتوحة؛ لا يُدّعى نجاح الالتقاط أو دقة استخلاص الجهة قبل ذلك.
- الاستخلاص heuristic؛ قد تتغير صياغة إشعارات التطبيقات وقد لا تصل بعض عمليات Vodafone Cash كإشعار تطبيق، وبعضها قد يصل عبر SMS وهو خارج النطاق.


## مراجعة ساكنة للإشعارات

أكد الفحص الساكن أن المستمع يمرر للطابور حقولًا محدودة بدل نص الإشعار، وأن مصادر الدفع تبدأ بقائمة فارغة وتُحصر في التطبيقات المختارة. أضيف رفض بعض صيغ الاستلام/الإيداع الإنجليزية الشائعة مثل `received` و`incoming` و`deposit` و`credited` لتقليل اقتراح العمليات الواردة. لا توجد اختبارات parser خاصة بـKotlin في `tests/` ولا compile فعلي للكود الأصلي؛ لذا تظل دقة الصيغ وتجنب كل الحالات الملتبسة مفتوحة حتى الاختبار على هاتف Android حقيقي.

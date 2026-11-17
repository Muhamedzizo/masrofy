import { ConfigPlugin, withAndroidManifest } from "@expo/config-plugins";

const SERVICE_NAME =
  "expo.modules.masrofy.notifications.MasrofyNotificationListenerService";
const RECEIVER_NAME =
  "expo.modules.masrofy.notifications.MasrofySmsReceiver";
const BIND_PERMISSION =
  "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE";
const LISTENER_ACTION =
  "android.service.notification.NotificationListenerService";
const SMS_RECEIVED_ACTION = "android.provider.Telephony.SMS_RECEIVED";
const SMS_BROADCAST_PERMISSION = "android.permission.BROADCAST_SMS";
const RECEIVE_SMS_PERMISSION = "android.permission.RECEIVE_SMS";
const MAIN_ACTION = "android.intent.action.MAIN";
const LAUNCHER_CATEGORY = "android.intent.category.LAUNCHER";

type ManifestWithQueries = {
  [key: string]: any;
  queries?: any[];
};

const withNotificationListener: ConfigPlugin = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest as ManifestWithQueries;
    const application = manifest.application?.[0];
    if (!application) {
      throw new Error("Android manifest is missing its application element.");
    }

    application.$ = application.$ ?? {};
    application.$["android:supportsRtl"] = "true";

    const permissions: any[] = manifest["uses-permission"] ?? (manifest["uses-permission"] = []);
    if (!permissions.some((entry: any) => entry.$?.["android:name"] === RECEIVE_SMS_PERMISSION)) {
      permissions.push({ $: { "android:name": RECEIVE_SMS_PERMISSION } });
    }

    const queries = manifest.queries ?? [];
    const hasLauncherQuery = queries.some((entry: any) => {
      const queryIntent = entry.intent?.[0];
      return (
        queryIntent?.action?.some((item: any) => item.$?.["android:name"] === MAIN_ACTION) &&
        queryIntent?.category?.some((item: any) => item.$?.["android:name"] === LAUNCHER_CATEGORY)
      );
    });
    if (!hasLauncherQuery) {
      queries.push({
        intent: [
          {
            action: [{ $: { "android:name": MAIN_ACTION } }],
            category: [{ $: { "android:name": LAUNCHER_CATEGORY } }],
          },
        ],
      });
    }
    manifest.queries = queries;

    const services = application.service ?? (application.service = []);
    let service = services.find((entry: any) => entry.$?.["android:name"] === SERVICE_NAME);
    if (!service) {
      service = { $: { "android:name": SERVICE_NAME } };
      services.push(service);
    }
    service.$ = {
      ...service.$,
      "android:name": SERVICE_NAME,
      "android:permission": BIND_PERMISSION,
      "android:exported": "false",
    };
    const serviceFilters = service["intent-filter"] ?? (service["intent-filter"] = []);
    let serviceFilter = serviceFilters.find((item: any) =>
      item.action?.some((action: any) => action.$?.["android:name"] === LISTENER_ACTION),
    );
    if (!serviceFilter) {
      serviceFilter = { action: [] };
      serviceFilters.push(serviceFilter);
    }
    serviceFilter.action = serviceFilter.action ?? [];
    if (!serviceFilter.action.some((action: any) => action.$?.["android:name"] === LISTENER_ACTION)) {
      serviceFilter.action.push({ $: { "android:name": LISTENER_ACTION } });
    }

    const receivers = application.receiver ?? (application.receiver = []);
    let receiver = receivers.find((entry: any) => entry.$?.["android:name"] === RECEIVER_NAME);
    if (!receiver) {
      receiver = { $: { "android:name": RECEIVER_NAME } };
      receivers.push(receiver);
    }
    receiver.$ = {
      ...receiver.$,
      "android:name": RECEIVER_NAME,
      "android:permission": SMS_BROADCAST_PERMISSION,
      "android:exported": "true",
    };
    const receiverFilters = receiver["intent-filter"] ?? (receiver["intent-filter"] = []);
    let receiverFilter = receiverFilters.find((item: any) =>
      item.action?.some((action: any) => action.$?.["android:name"] === SMS_RECEIVED_ACTION),
    );
    if (!receiverFilter) {
      receiverFilter = { action: [] };
      receiverFilters.push(receiverFilter);
    }
    receiverFilter.action = receiverFilter.action ?? [];
    if (!receiverFilter.action.some((action: any) => action.$?.["android:name"] === SMS_RECEIVED_ACTION)) {
      receiverFilter.action.push({ $: { "android:name": SMS_RECEIVED_ACTION } });
    }

    return modConfig;
  });

export default withNotificationListener;

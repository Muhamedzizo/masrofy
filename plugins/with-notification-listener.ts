import { ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';

const SERVICE_NAME = 'expo.modules.masrofy.notifications.MasrofyNotificationListenerService';
const BIND_PERMISSION = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';
const LISTENER_ACTION = 'android.service.notification.NotificationListenerService';

const withNotificationListener: ConfigPlugin = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Android manifest is missing its application element.');
    }

    application.$ = application.$ ?? {};
    application.$['android:supportsRtl'] = 'true';

    const services = application.service ?? (application.service = []);
    let service = services.find((entry) => entry.$?.['android:name'] === SERVICE_NAME);
    if (!service) {
      service = { $: { 'android:name': SERVICE_NAME } };
      services.push(service);
    }

    service.$ = {
      ...service.$,
      'android:name': SERVICE_NAME,
      'android:permission': BIND_PERMISSION,
      // Android's NotificationListenerService documentation uses exported=false;
      // the system grants access through the signature-level binding permission.
      'android:exported': 'false',
    };

    const filters = service['intent-filter'] ?? (service['intent-filter'] = []);
    let filter = filters.find((item) =>
      item.action?.some((action) => action.$?.['android:name'] === LISTENER_ACTION),
    );
    if (!filter) {
      filter = { action: [] };
      filters.push(filter);
    }
    filter.action = filter.action ?? [];
    if (!filter.action.some((action) => action.$?.['android:name'] === LISTENER_ACTION)) {
      filter.action.push({ $: { 'android:name': LISTENER_ACTION } });
    }

    return modConfig;
  });

export default withNotificationListener;

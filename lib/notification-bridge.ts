import { requireOptionalNativeModule } from "expo-modules-core";

export type NotificationSource = string;

export type NotificationCandidate = {
  id: string;
  source: NotificationSource;
  amountPiasters: number;
  timestamp: number;
  description?: string;
};

export type LaunchableApp = { packageName: string; label: string };
export type ConfiguredNotificationApp = {
  packageName: string;
  source: string;
  label: string;
};
export type SmsSenderSource = {
  sender: string;
  source: string;
  label: string;
};

export const PAYMENT_SOURCES: ReadonlyArray<{
  value: NotificationSource;
  label: string;
  packageName: string;
}> = [
  {
    value: "instapay",
    label: "إنستا باي",
    packageName: "com.egyptianbanks.instapay",
  },
  {
    value: "vodafone",
    label: "فودافون كاش",
    packageName: "com.emeint.android.myservices",
  },
  { value: "fawry", label: "myFawry", packageName: "com.fawry.myfawry" },
];

interface MasrofyNotificationsNativeModule {
  getNotificationAccessEnabled(): Promise<boolean>;
  openNotificationAccessSettings(): Promise<void>;
  setNotificationSources(sources: NotificationSource[]): Promise<void>;
  setConfiguredNotificationApps(encoded: string): Promise<void>;
  setSmsSenderSources(encoded: string): Promise<void>;
  listLaunchableApps(): Promise<LaunchableApp[]>;
  getSmsPermissionGranted(): Promise<boolean>;
  requestSmsPermission(): Promise<unknown>;
  drainPendingCandidates(): Promise<NotificationCandidate[]>;
  acknowledgeCandidates(ids: string[]): Promise<void>;
}

function getNativeModule(): MasrofyNotificationsNativeModule | null {
  try {
    return requireOptionalNativeModule<MasrofyNotificationsNativeModule>(
      "MasrofyNotifications",
    );
  } catch {
    return null;
  }
}

export async function getNotificationAccessEnabled(): Promise<boolean> {
  try {
    return (await getNativeModule()?.getNotificationAccessEnabled()) ?? false;
  } catch {
    return false;
  }
}

export async function openNotificationAccessSettings(): Promise<void> {
  try {
    await getNativeModule()?.openNotificationAccessSettings();
  } catch {
    // A missing native module should not break the rest of the application.
  }
}

export async function setNotificationSources(
  sources: NotificationSource[],
): Promise<void> {
  try {
    await getNativeModule()?.setNotificationSources(sources);
  } catch {
    // Selection still remains in local app settings.
  }
}

export async function setConfiguredNotificationApps(
  apps: ConfiguredNotificationApp[],
): Promise<void> {
  try {
    await getNativeModule()?.setConfiguredNotificationApps(JSON.stringify(apps));
  } catch {
    // A missing native module is safe in web/Expo Go.
  }
}

export async function setSmsSenderSources(
  senders: SmsSenderSource[],
): Promise<void> {
  try {
    await getNativeModule()?.setSmsSenderSources(JSON.stringify(senders));
  } catch {
    // A missing native module is safe in web/Expo Go.
  }
}

export async function listLaunchableApps(): Promise<LaunchableApp[]> {
  try {
    const apps = await getNativeModule()?.listLaunchableApps();
    if (!Array.isArray(apps)) return [];
    return apps.filter(
      (item): item is LaunchableApp =>
        typeof item?.packageName === "string" &&
        typeof item?.label === "string" &&
        item.label.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export async function getSmsPermissionGranted(): Promise<boolean> {
  try {
    return (await getNativeModule()?.getSmsPermissionGranted()) ?? false;
  } catch {
    return false;
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  try {
    const response = await getNativeModule()?.requestSmsPermission();
    if (typeof response === "boolean") return response;
    if (response && typeof response === "object") {
      const info = response as Record<string, unknown>;
      return info.granted === true || info.status === "granted";
    }
    return await getSmsPermissionGranted();
  } catch {
    return false;
  }
}

export async function drainPendingCandidates(): Promise<NotificationCandidate[]> {
  try {
    const candidates = await getNativeModule()?.drainPendingCandidates();
    if (!Array.isArray(candidates)) return [];
    return candidates.filter(
      (candidate): candidate is NotificationCandidate =>
        typeof candidate?.id === "string" &&
        typeof candidate.source === "string" &&
        /^[A-Za-z0-9_.:-]{1,80}$/.test(candidate.source) &&
        Number.isInteger(candidate.amountPiasters) &&
        candidate.amountPiasters > 0 &&
        Number.isFinite(candidate.timestamp) &&
        (typeof candidate.description === "undefined" ||
          (typeof candidate.description === "string" &&
            candidate.description.trim().length > 0 &&
            candidate.description.length <= 48 &&
            !/[\u0000-\u001f\u007f]/.test(candidate.description))),
    );
  } catch {
    return [];
  }
}

export async function acknowledgeCandidates(ids: string[]): Promise<void> {
  try {
    await getNativeModule()?.acknowledgeCandidates(ids);
  } catch {
    // A missing native module should not break callers.
  }
}

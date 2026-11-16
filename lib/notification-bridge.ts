import { requireOptionalNativeModule } from 'expo-modules-core';

export type NotificationSource = 'instapay' | 'vodafone' | 'fawry';

export type NotificationCandidate = {
  id: string;
  source: NotificationSource;
  amountPiasters: number;
  timestamp: number;
  description?: string;
};

export const PAYMENT_SOURCES: ReadonlyArray<{
  value: NotificationSource;
  label: string;
}> = [
  { value: 'instapay', label: 'إنستا باي' },
  { value: 'vodafone', label: 'فودافون كاش' },
  { value: 'fawry', label: 'myFawry' },
];

interface MasrofyNotificationsNativeModule {
  getNotificationAccessEnabled(): Promise<boolean>;
  openNotificationAccessSettings(): Promise<void>;
  setNotificationSources(sources: NotificationSource[]): Promise<void>;
  drainPendingCandidates(): Promise<NotificationCandidate[]>;
  acknowledgeCandidates(ids: string[]): Promise<void>;
}

function getNativeModule(): MasrofyNotificationsNativeModule | null {
  try {
    return requireOptionalNativeModule<MasrofyNotificationsNativeModule>('MasrofyNotifications');
  } catch {
    // Expo Go, web, and stale native binaries should remain safe no-op environments.
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
    // No system settings activity is available in web/Expo Go.
  }
}

export async function setNotificationSources(sources: NotificationSource[]): Promise<void> {
  try {
    await getNativeModule()?.setNotificationSources(sources);
  } catch {
    // The source selection is persisted only by an installed native module.
  }
}

export async function drainPendingCandidates(): Promise<NotificationCandidate[]> {
  try {
    const candidates = await getNativeModule()?.drainPendingCandidates();
    if (!Array.isArray(candidates)) return [];
    return candidates.filter(
      (candidate): candidate is NotificationCandidate =>
        typeof candidate?.id === 'string' &&
        ['instapay', 'vodafone', 'fawry'].includes(candidate.source) &&
        Number.isInteger(candidate.amountPiasters) &&
        candidate.amountPiasters > 0 &&
        Number.isFinite(candidate.timestamp) &&
        (typeof candidate.description === 'undefined' ||
          (typeof candidate.description === 'string' &&
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
    // A missing module must not break callers.
  }
}

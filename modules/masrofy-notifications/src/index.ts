// Public JavaScript facade for the local Expo module package.
// The app-facing contract is implemented once in lib/notification-bridge.ts.
export {
  PAYMENT_SOURCES,
  acknowledgeCandidates,
  drainPendingCandidates,
  getNotificationAccessEnabled,
  openNotificationAccessSettings,
  setNotificationSources,
} from '../../../lib/notification-bridge';
export type { NotificationCandidate, NotificationSource } from '../../../lib/notification-bridge';

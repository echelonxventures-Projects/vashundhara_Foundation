/**
 * Notification Status Constants
 */

export const NOTIFICATION_STATUSES = [
  'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'
] as const;

export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];
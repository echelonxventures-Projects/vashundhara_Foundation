/**
 * Notification Channel Constants
 */

export const NOTIFICATION_CHANNELS = [
  'EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WEBHOOK'
] as const;

export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];
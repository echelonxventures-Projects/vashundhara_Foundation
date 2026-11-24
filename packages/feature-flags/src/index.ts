import { createHash } from 'crypto';

export interface Flag {
  key: string;
  type: 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON';
  defaultValue: unknown;
  isEnabled: boolean;
  rolloutPercentage: number;
}

/** Stable 0-99 bucket, so a user keeps the same result between requests. */
export const bucket = (flagKey: string, subject: string): number =>
  createHash('sha256').update(`${flagKey}:${subject}`).digest().readUInt32BE(0) % 100;

/** A disabled flag, or a subject outside the rollout, gets `off`. */
export function evaluate(flag: Flag, subject: string): { on: boolean; value: unknown } {
  const on = flag.isEnabled && bucket(flag.key, subject) < flag.rolloutPercentage;
  if (flag.type === 'BOOLEAN') return { on, value: on && flag.defaultValue !== false };
  return { on, value: on ? flag.defaultValue : null };
}

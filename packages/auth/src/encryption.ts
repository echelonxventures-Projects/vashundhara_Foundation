import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** AES-256-GCM. `context` is authenticated, so a value cannot be moved to another row or NGO. */
export class FieldCipher {
  private readonly key: Buffer;
  constructor(keyBase64: string) {
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64 encoded');
  }
  encrypt(plain: string, context: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    c.setAAD(Buffer.from(context));
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return `v1.${Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')}`;
  }
  decrypt(value: string, context: string): string {
    if (!value.startsWith('v1.')) throw new Error('Unknown ciphertext version');
    const raw = Buffer.from(value.slice(3), 'base64url');
    const d = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    d.setAAD(Buffer.from(context));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  }
}

import { expect, it } from 'vitest';
import { isPublicIp, safePost } from './webhooks';
it('blocks internal addresses', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fc00::1', '::ffff:10.0.0.1', '2002:a00:1::']) expect(isPublicIp(ip), ip).toBe(false);
  for (const ip of ['8.8.8.8', '2606:4700::1111']) expect(isPublicIp(ip), ip).toBe(true);
});
it('refuses unsafe webhook targets', async () => {
  for (const u of ['http://example.com', 'https://127.0.0.1/', 'https://localhost/', 'https://[::1]/', 'https://u:p@example.com/', 'https://example.com:8443/']) await expect(safePost(u, '{}', {})).rejects.toThrow();
});

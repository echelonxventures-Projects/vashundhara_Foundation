import type { MetadataRoute } from 'next';
import { getTenant } from '@/lib/server';
export default async function robots(): Promise<MetadataRoute.Robots> {
  const t = await getTenant();
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/*/account', '/*/staff', '/*/login'] }, sitemap: t ? `${t.url}/sitemap.xml` : undefined };
}

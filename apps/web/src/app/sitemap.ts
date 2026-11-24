import type { MetadataRoute } from 'next';
import { getTenant, serverApi } from '@/lib/server';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const t = await getTenant();
  if (!t) return [];
  const [c, e, p] = await Promise.all(['public/campaigns?limit=100', 'public/events?limit=100', 'public/pages?limit=100'].map((u) => serverApi<{ items: { slug: string; kind?: string }[] }>(u)));
  const paths = ['', '/campaigns', '/donate', '/events', '/volunteer', '/contact', ...(c?.items ?? []).map((x) => `/campaigns/${x.slug}`), ...(e?.items ?? []).map((x) => `/events/${x.slug}`), ...(p?.items ?? []).map((x) => (x.kind === 'post' ? `/blog/${x.slug}` : `/${x.slug}`))];
  return paths.flatMap((path) => t.supportedLocales.map((l) => ({ url: `${t.url}/${l}${path}` })));
}

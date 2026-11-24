import type { MetadataRoute } from 'next';
import { getTenant } from '@/lib/server';
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTenant();
  const name = t?.name ?? 'NGO';
  return { name, short_name: name.slice(0, 12), start_url: `/${t?.defaultLocale ?? 'en'}`, display: 'standalone', background_color: '#fbfaf6', theme_color: t?.settings.primaryColor ?? '#1f6b45', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] };
}

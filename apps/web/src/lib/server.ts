import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';

const BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
export const proxyHeaders = (host: string, ip: string): Record<string, string> => ({ 'x-vf-host': host, 'x-vf-ip': ip, ...(process.env.INTERNAL_PROXY_SECRET ? { 'x-internal-proxy': process.env.INTERNAL_PROXY_SECRET } : {}) });

/** The ingress sets x-real-ip. Never trust the left end of x-forwarded-for: visitors can write it. */
export const clientIp = (h: Headers) => h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',').pop()?.trim() ?? '127.0.0.1';

/** Public data for server rendering. Returns null when missing or when the API is down. */
export const serverApi = cache(async <T>(path: string): Promise<T | null> => {
  const h = await headers();
  const host = h.get('host') ?? 'localhost';
  try {
    const r = await fetch(`${BASE}/api/v1/${path}`, { headers: { ...proxyHeaders(host, clientIp(h)), 'x-vf-ssr': '1' }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
});

export interface Tenant {
  slug: string; name: string; description: string | null; logoUrl: string | null; status: string; url: string; defaultLocale: string; supportedLocales: string[];
  legalName: string | null; registrationNo: string | null; has80G: boolean; acceptsForeign: boolean;
  settings: { primaryColor?: string; tagline?: string; about?: string; contactEmail?: string; contactPhone?: string; contactAddress?: string; facebook?: string; instagram?: string; youtube?: string; linkedin?: string; impact?: { value: string; label: string; source: string }[]; minDonationMinor?: number };
}
export const getTenant = () => serverApi<Tenant>('tenant/public');
export const getFlags = async () => (await serverApi<Record<string, unknown>>('feature-flags/evaluate')) ?? {};

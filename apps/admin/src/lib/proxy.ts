import 'server-only';
export const proxyHeaders = (host: string, ip: string): Record<string, string> => ({ 'x-vf-host': host, 'x-vf-ip': ip, ...(process.env.INTERNAL_PROXY_SECRET ? { 'x-internal-proxy': process.env.INTERNAL_PROXY_SECRET } : {}) });
/** The ingress sets x-real-ip. The left end of x-forwarded-for can be written by visitors. */
export const clientIp = (h: Headers) => h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',').pop()?.trim() ?? '127.0.0.1';

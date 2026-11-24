import { NextRequest } from 'next/server';
import { clientIp, proxyHeaders } from '@/lib/proxy';

const BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
const PASS = ['accept', 'accept-language', 'authorization', 'content-type', 'cookie', 'user-agent', 'x-requested-with', 'x-request-id', 'x-api-key', 'x-razorpay-signature', 'x-razorpay-event-id'];

/** Same-origin gateway to the API. Only named headers are forwarded. */
async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.some((p) => p === '..' || p === '.' || p.includes('/') || p.includes('\\'))) return Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  const rest = path[0] === 'v1' ? path.slice(1) : path;
  const headers = new Headers(proxyHeaders(req.headers.get('host') ?? 'localhost', clientIp(req.headers)));
  for (const k of PASS) { const v = req.headers.get(k); if (v) headers.set(k, v); }
  if (Number(req.headers.get('content-length') ?? 0) > 3_000_000) return Response.json({ error: { code: 'TOO_LARGE', message: 'Too large' } }, { status: 413 });
  try {
    const r = await fetch(`${BASE}/api/v1/${rest.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, {
      method: req.method, headers, redirect: 'manual', signal: AbortSignal.timeout(30_000), body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer()
    });
    const out = new Headers({ 'cache-control': r.headers.get('cache-control') ?? 'no-store' });
    for (const k of ['content-type', 'content-disposition', 'location', 'x-request-id']) { const v = r.headers.get(k); if (v) out.set(k, v); }
    for (const c of r.headers.getSetCookie()) out.append('set-cookie', c);
    return new Response(r.body, { status: r.status, headers: out });
  } catch {
    return Response.json({ error: { code: 'UNAVAILABLE', message: 'The service is not available right now' } }, { status: 503 });
  }
}
export const dynamic = 'force-dynamic';
export { handler as DELETE, handler as GET, handler as POST, handler as PUT };

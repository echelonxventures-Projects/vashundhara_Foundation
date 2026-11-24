import { NextRequest, NextResponse } from 'next/server';
export default function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${dev ? ' ws:' : ''}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`;
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  return res;
}
export const config = { matcher: ['/((?!api|_next|health|.*\\..*).*)'] };

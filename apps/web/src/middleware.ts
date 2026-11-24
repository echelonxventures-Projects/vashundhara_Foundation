import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:", "font-src 'self'",
    `connect-src 'self' https://*.razorpay.com ${process.env.CSP_UPLOAD_ORIGIN ?? ''}${dev ? ' ws:' : ''}`, 'frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.youtube-nocookie.com',
    "worker-src 'self'", "manifest-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'"
  ].join('; ');
  // next-intl forwards request headers, so the nonce reaches the renderer. Nothing from the request is copied to the response.
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  headers.set('x-vf-path', req.nextUrl.pathname);
  const res: NextResponse = intl(new NextRequest(req, { headers }));
  res.headers.set('content-security-policy', csp);
  return res;
}
export const config = { matcher: ['/((?!api|_next|health|.*\\..*).*)'] };

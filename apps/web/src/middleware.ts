import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

const PUBLIC_PATHS = ['/health', '/api/health', '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path))
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Run next-intl middleware for locale handling FIRST (always)
  const intlResponse = intlMiddleware(request)

  // If intl middleware returns a redirect (e.g., for locale prefix), return it directly with our headers
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    // Add tenant resolution headers to the redirect response
    const hostname = request.headers.get('host') || ''
    const subdomain = hostname.split('.')[0]
    const isMainDomain = ['localhost', 'vashundharafoundation.org', 'www.vashundharafoundation.org'].includes(hostname.split(':')[0])

    const requestHeaders = new Headers(request.headers)
    if (!isMainDomain && subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
      requestHeaders.set('x-tenant-slug', subdomain)
    }

    const tenantIdHeader = request.headers.get('x-tenant-id')
    if (tenantIdHeader) {
      requestHeaders.set('x-tenant-id', tenantIdHeader)
    }

    // Create new redirect response with our headers
    const redirectResponse = NextResponse.redirect(intlResponse.headers.get('location')!)

    // Add tenant headers to the redirect response
    requestHeaders.forEach((value, key) => {
      redirectResponse.headers.set(key, value)
    })

    // Copy cookies from intl response
    intlResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })

    return redirectResponse
  }

  // Skip additional processing for public paths
  if (isPublicPath(pathname)) {
    return intlResponse
  }

  // Add tenant resolution headers
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]
  const isMainDomain = ['localhost', 'vashundharafoundation.org', 'www.vashundharafoundation.org'].includes(hostname.split(':')[0])

  // Add tenant context headers for downstream use
  const requestHeaders = new Headers(request.headers)
  if (!isMainDomain && subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'app') {
    requestHeaders.set('x-tenant-slug', subdomain)
  }

  // Add tenant ID from header if present
  const tenantIdHeader = request.headers.get('x-tenant-id')
  if (tenantIdHeader) {
    requestHeaders.set('x-tenant-id', tenantIdHeader)
  }

  // Clone the intl response with modified request headers (preserving status, headers, cookies)
  const newResponse = NextResponse.next({
    request: { headers: requestHeaders }
  })

  // Copy all headers from intl middleware response (except content-length which will be recalculated)
  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-length') {
      newResponse.headers.set(key, value)
    }
  })

  // Copy all cookies from intl middleware response (includes locale cookie)
  intlResponse.cookies.getAll().forEach(cookie => {
    newResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  return newResponse
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'
  ]
}
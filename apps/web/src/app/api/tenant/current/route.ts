import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const tenantId = request.headers.get('x-tenant-id')
    const tenantSlug = request.headers.get('x-tenant-slug')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') || ''
    }

    if (tenantId) headers['x-tenant-id'] = tenantId
    if (tenantSlug) headers['x-tenant-slug'] = tenantSlug

    const response = await fetch(`${apiUrl}/api/v1/tenants/current`, {
      method: 'GET',
      headers,
      credentials: 'include'
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ tenant: null, context: null }, { status: 404 })
      }
      return NextResponse.json(
        { message: 'Failed to fetch tenant' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Tenant fetch error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
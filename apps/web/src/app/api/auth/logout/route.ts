import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || ''
      },
      credentials: 'include'
    })

    const responseHeaders = new Headers()
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      responseHeaders.set('set-cookie', setCookieHeader)
    }

    return NextResponse.json({ success: true }, { headers: responseHeaders })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
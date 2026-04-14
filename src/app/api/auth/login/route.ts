import { NextRequest, NextResponse } from 'next/server'
import {
  AUTH_CONFIGURATION_ERROR,
  AUTH_SESSION_COOKIE,
  authenticateUser,
  createSessionToken,
  getAuthCookieOptions,
  isAuthConfigured,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

type LoginRequestBody = {
  username?: string
  password?: string
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json({ ok: false, error: AUTH_CONFIGURATION_ERROR }, { status: 500 })
    }

    const body = (await request.json()) as LoginRequestBody
    const session = authenticateUser(body.username || '', body.password || '')

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Невірний логін або пароль.' }, { status: 401 })
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        username: session.username,
        role: session.role,
        displayName: session.displayName,
      },
    })

    response.cookies.set(AUTH_SESSION_COOKIE, createSessionToken(session), getAuthCookieOptions())

    return response
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Сталася помилка авторизації.' },
      { status: 500 }
    )
  }
}

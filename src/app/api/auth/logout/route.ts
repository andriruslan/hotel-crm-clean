import { NextResponse } from 'next/server'
import { AUTH_SESSION_COOKIE, clearAuthCookieOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_SESSION_COOKIE, '', clearAuthCookieOptions())
  return response
}

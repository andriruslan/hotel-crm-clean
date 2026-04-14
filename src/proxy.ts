import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_SESSION_COOKIE, getAuthSessionFromToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login']
const PUBLIC_API_PREFIXES = ['/api/auth/']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublicPath(pathname)) {
    if (pathname === '/login') {
      const session = getAuthSessionFromToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value)

      if (session) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    return NextResponse.next()
  }

  const session = getAuthSessionFromToken(request.cookies.get(AUTH_SESSION_COOKIE)?.value)

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Потрібно увійти в систему.' }, { status: 401 })
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-crm-auth-user', session.username)
  requestHeaders.set('x-crm-auth-role', session.role)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}

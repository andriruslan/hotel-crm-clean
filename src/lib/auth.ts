import { createHmac, timingSafeEqual } from 'node:crypto'

export const AUTH_SESSION_COOKIE = 'crm_auth_session'
export const AUTH_CONFIGURATION_ERROR =
  'Не налаштовано вхід до CRM. Додай CRM_AUTH_LOGIN та CRM_AUTH_PASSWORD або CRM_AUTH_USERS_JSON.'

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12
const SESSION_VERSION = 1

export type AuthRole = 'admin' | 'manager' | 'viewer' | string

type AuthUserRecord = {
  username: string
  password: string
  role: AuthRole
  displayName: string
}

type SessionPayload = {
  v: number
  u: string
  r: AuthRole
  n: string
  e: number
}

export type AuthSession = {
  username: string
  role: AuthRole
  displayName: string
  expiresAt: number
}

type CookieReader = {
  get(name: string): { value: string } | undefined
}

function getSessionSecret() {
  return (process.env.CRM_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
}

function getSessionTtlSeconds() {
  const parsedValue = Number(process.env.CRM_AUTH_TTL_SECONDS || DEFAULT_SESSION_TTL_SECONDS)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_SESSION_TTL_SECONDS
  }

  return Math.floor(parsedValue)
}

function safeCompare(leftValue: string, rightValue: string) {
  const leftBuffer = Buffer.from(leftValue)
  const rightBuffer = Buffer.from(rightValue)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function createSignature(encodedPayload: string) {
  return createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url')
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function normalizeUserRecord(inputValue: unknown): AuthUserRecord | null {
  if (!inputValue || typeof inputValue !== 'object') {
    return null
  }

  const rawValue = inputValue as Record<string, unknown>
  const username = typeof rawValue.username === 'string' ? rawValue.username.trim() : ''
  const password = typeof rawValue.password === 'string' ? rawValue.password : ''
  const role = typeof rawValue.role === 'string' && rawValue.role.trim() ? rawValue.role.trim() : 'manager'
  const displayName =
    typeof rawValue.displayName === 'string' && rawValue.displayName.trim() ? rawValue.displayName.trim() : username

  if (!username || !password) {
    return null
  }

  return {
    username,
    password,
    role,
    displayName,
  }
}

export function getConfiguredAuthUsers() {
  const usersJson = process.env.CRM_AUTH_USERS_JSON?.trim()

  if (usersJson) {
    try {
      const parsedValue = JSON.parse(usersJson)

      if (!Array.isArray(parsedValue)) {
        return []
      }

      return parsedValue
        .map((item) => normalizeUserRecord(item))
        .filter((item): item is AuthUserRecord => Boolean(item))
    } catch {
      return []
    }
  }

  const username = (process.env.CRM_AUTH_LOGIN || '').trim()
  const password = process.env.CRM_AUTH_PASSWORD || ''
  const role = (process.env.CRM_AUTH_ROLE || 'admin').trim() || 'admin'
  const displayName = (process.env.CRM_AUTH_DISPLAY_NAME || username).trim() || username

  if (!username || !password) {
    return []
  }

  return [
    {
      username,
      password,
      role,
      displayName,
    },
  ]
}

export function isAuthConfigured() {
  return Boolean(getSessionSecret()) && getConfiguredAuthUsers().length > 0
}

export function authenticateUser(username: string, password: string): AuthSession | null {
  const normalizedUsername = username.trim()

  if (!normalizedUsername || !password) {
    return null
  }

  const matchedUser = getConfiguredAuthUsers().find(
    (user) => safeCompare(user.username, normalizedUsername) && safeCompare(user.password, password)
  )

  if (!matchedUser) {
    return null
  }

  return {
    username: matchedUser.username,
    role: matchedUser.role,
    displayName: matchedUser.displayName,
    expiresAt: Date.now() + getSessionTtlSeconds() * 1000,
  }
}

export function createSessionToken(session: AuthSession) {
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    u: session.username,
    r: session.role,
    n: session.displayName,
    e: session.expiresAt,
  }
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = createSignature(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function getAuthSessionFromToken(token?: string | null): AuthSession | null {
  if (!token || !getSessionSecret()) {
    return null
  }

  const [encodedPayload, signature] = token.split('.')

  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = createSignature(encodedPayload)

  if (!safeCompare(signature, expectedSignature)) {
    return null
  }

  try {
    const parsedValue = JSON.parse(fromBase64Url(encodedPayload)) as Partial<SessionPayload>

    if (
      parsedValue.v !== SESSION_VERSION ||
      typeof parsedValue.u !== 'string' ||
      typeof parsedValue.r !== 'string' ||
      typeof parsedValue.n !== 'string' ||
      typeof parsedValue.e !== 'number'
    ) {
      return null
    }

    if (parsedValue.e <= Date.now()) {
      return null
    }

    return {
      username: parsedValue.u,
      role: parsedValue.r,
      displayName: parsedValue.n,
      expiresAt: parsedValue.e,
    }
  } catch {
    return null
  }
}

export function getAuthSessionFromCookies(cookieStore: CookieReader) {
  return getAuthSessionFromToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value)
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: getSessionTtlSeconds(),
  }
}

export function clearAuthCookieOptions() {
  return {
    ...getAuthCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  }
}

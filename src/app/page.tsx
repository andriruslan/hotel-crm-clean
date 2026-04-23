import LogoutButton from '@/components/auth/logout-button'
import { AUTH_SESSION_COOKIE, getAuthSessionFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import Link from 'next/link'

const actions = [
  { href: '/availability', title: 'Доступність номерів' },
  { href: '/bookings/new', title: 'Нове бронювання' },
  { href: '/bookings/arrivals', title: 'Заїзди сьогодні' },
  { href: '/bookings/departures', title: 'Виїзди сьогодні' },
  { href: '/bookings/search', title: 'Контроль передоплат' },
]

const DEPLOY_MARKER_LABEL = '????????: 23.04.2026 11:25'

export default async function HomePage() {
  const cookieStore = await cookies()
  const session = getAuthSessionFromToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value)

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">CRM &quot;VILLAGE WINE&quot;</h1>
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 sm:text-sm">
                {DEPLOY_MARKER_LABEL}
              </div>
              {session ? (
                <div className="inline-flex items-center rounded-full bg-[var(--crm-wine-soft)] px-3 py-1 text-sm font-medium text-[var(--crm-wine)]">
                  {session.displayName} · {session.role}
                </div>
              ) : null}
            </div>

            <LogoutButton className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-[var(--crm-vine)] bg-[var(--crm-vine-soft)] px-3 text-xs font-semibold text-[var(--crm-vine-dark)] shadow-sm transition hover:border-[var(--crm-vine-dark)] hover:bg-[var(--crm-vine-soft-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-11 sm:px-4 sm:text-sm" />
          </div>
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-24 items-center justify-center rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-4 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)] hover:shadow-md sm:min-h-28 sm:px-5 sm:py-5 lg:min-h-32"
            >
              <div className="w-full text-center text-base font-semibold leading-tight sm:text-lg lg:text-xl">{action.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

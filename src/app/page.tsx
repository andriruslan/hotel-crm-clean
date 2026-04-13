import Link from 'next/link'

const actions = [
  { href: '/availability', title: 'Доступність номерів' },
  { href: '/bookings/new', title: 'Нове бронювання' },
  { href: '/bookings/arrivals', title: 'Заїзди сьогодні' },
  { href: '/bookings/departures', title: 'Виїзди сьогодні' },
  { href: '/bookings/search', title: 'Контроль передоплат' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-5 py-5 shadow-sm sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">CRM &quot;VILLAGE WINE&quot;</h1>
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-32 items-center rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)] hover:shadow-md"
            >
              <div className="text-lg font-semibold leading-tight sm:text-xl">{action.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

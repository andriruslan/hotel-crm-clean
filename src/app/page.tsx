import Link from 'next/link'

const actions = [
  { href: '/availability', title: 'Доступність номерів', description: 'Перевірка вільних номерів на дату або діапазон' },
  { href: '/bookings/new', title: 'Нове бронювання', description: 'Створення нового бронювання гостя' },
  { href: '/bookings/arrivals', title: 'Заїзди сьогодні', description: 'Список гостей, які мають заїхати сьогодні' },
  { href: '/bookings/search', title: 'Пошук гостя', description: 'Пошук по телефону, ПІБ або бронюванню' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold">CRM готелю</h1>
        <p className="mb-8 text-sm text-neutral-600">Нова чиста система бронювань і заселення</p>

        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="text-xl font-semibold">{action.title}</div>
              <div className="mt-2 text-sm text-neutral-600">{action.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

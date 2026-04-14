import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/auth/login-form'
import { getAuthSessionFromCookies, isAuthConfigured } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const cookieStore = await cookies()
  const session = getAuthSessionFromCookies(cookieStore)

  if (session) {
    redirect('/')
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,460px)]">
        <section className="hidden rounded-[2rem] border border-[var(--crm-wine-border)] bg-[linear-gradient(145deg,rgba(111,32,49,0.95),rgba(87,112,56,0.88))] p-8 text-white shadow-xl lg:block">
          <div className="max-w-md space-y-4">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold tracking-[0.18em] uppercase">
              Village Wine
            </div>
            <h1 className="text-4xl font-bold leading-tight">CRM для щоденної роботи готелю</h1>
            <p className="text-base leading-7 text-white/85">
              Вхід потрібен, щоб CRM була безпечною при публікації у вебі. Поточний механізм уже готовий до подальшого
              розділення на ролі та права доступу.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--crm-wine-border)] bg-white/95 p-5 shadow-lg sm:p-6 lg:p-8">
          <div className="mb-6 space-y-2">
            <div className="inline-flex rounded-full bg-[var(--crm-wine-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--crm-wine)]">
              Вхід до системи
            </div>
            <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)]">CRM &quot;VILLAGE WINE&quot;</h1>
            <p className="text-sm leading-6 text-[color:rgba(45,28,35,0.72)]">
              Введи логін і пароль, щоб відкрити екрани бронювань, заїздів, виїздів і пошуку номерів.
            </p>
          </div>

          <LoginForm authConfigured={isAuthConfigured()} />
        </section>
      </div>
    </main>
  )
}

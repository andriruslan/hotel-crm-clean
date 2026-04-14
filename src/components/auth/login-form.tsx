'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useMemo, useState, useTransition } from 'react'

type LoginFormProps = {
  authConfigured: boolean
}

function getSafeNextPath(rawValue: string | null) {
  if (!rawValue || !rawValue.startsWith('/')) {
    return '/'
  }

  return rawValue
}

export default function LoginForm({ authConfigured }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const nextPath = useMemo(() => getSafeNextPath(searchParams.get('next')), [searchParams])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!authConfigured) {
      setError('Авторизація ще не налаштована. Додай облікові дані в змінні середовища.')
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
          }),
        })

        const data = (await response.json()) as { ok?: boolean; error?: string }

        if (!response.ok || !data.ok) {
          setError(data.error || 'Не вдалося виконати вхід.')
          return
        }

        router.replace(nextPath)
        router.refresh()
      } catch {
        setError('Не вдалося з’єднатися із сервером.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Логін</span>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-[var(--crm-wine-border)] bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--crm-wine)] focus:ring-2 focus:ring-[var(--crm-wine-soft)]"
          placeholder="Введи логін"
          disabled={isPending}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">Пароль</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-[var(--crm-wine-border)] bg-white px-4 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--crm-wine)] focus:ring-2 focus:ring-[var(--crm-wine-soft)]"
          placeholder="Введи пароль"
          disabled={isPending}
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-[var(--crm-danger)] bg-[var(--crm-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--crm-danger)]">
          {error}
        </div>
      ) : null}

      {!authConfigured ? (
        <div className="rounded-2xl border border-[var(--crm-warning)] bg-[var(--crm-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
          У Vercel або в `.env.local` потрібно додати `CRM_AUTH_LOGIN` і `CRM_AUTH_PASSWORD`.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !authConfigured}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--crm-wine)] px-4 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Входимо...' : 'Увійти'}
      </button>
    </form>
  )
}

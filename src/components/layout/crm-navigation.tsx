'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

const STORAGE_KEY = 'crm-navigation-history'
const HOME_PATH = '/'

function readHistory(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY)
    if (!value) {
      return []
    }

    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeHistory(history: string[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-20)))
}

export default function CrmNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === HOME_PATH

  useEffect(() => {
    const history = readHistory()

    if (history.at(-1) === pathname) {
      return
    }

    writeHistory([...history, pathname])
  }, [pathname])

  function handleBack() {
    const history = readHistory()

    if (history.length <= 1) {
      router.push(HOME_PATH)
      return
    }

    const previousPath = history.at(-2) ?? HOME_PATH
    writeHistory(history.slice(0, -1))
    router.push(previousPath)
  }

  if (isHome) {
    return null
  }

  return (
    <div className="sticky top-0 z-30 border-b border-[var(--crm-wine-border)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl justify-end px-3 py-3 sm:px-4 lg:px-6">
        <div className="grid w-full max-w-md grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-3 text-center text-sm font-semibold leading-tight text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)] active:scale-[0.99]"
          >
            Повернутися назад
          </button>

          <Link
            href={HOME_PATH}
            aria-current={isHome ? 'page' : undefined}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--crm-wine)] px-3 text-center text-sm font-semibold leading-tight text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)] active:scale-[0.99]"
          >
            На Головний екран
          </Link>
        </div>
      </div>
    </div>
  )
}

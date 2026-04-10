'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AvailabilityItem } from '@/types/availability'
import { addOneDay, getTodayDate } from '@/lib/dates'

type ApiResponse = {
  ok: boolean
  items?: AvailabilityItem[]
  error?: string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function AvailabilityPage() {
  const today = useMemo(() => getTodayDate(), [])
  const tomorrow = useMemo(() => addOneDay(today), [today])

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [guestsCount, setGuestsCount] = useState(2)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AvailabilityItem[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setItems([])
    setSearched(true)

    try {
      const params = new URLSearchParams({
        checkIn,
        checkOut,
        guestsCount: String(guestsCount),
      })

      const response = await fetch(`/api/availability?${params.toString()}`)
      const rawText = await response.text()
      const data: ApiResponse = JSON.parse(rawText)

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося отримати доступні номери')
      }

      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-3">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100 active:scale-[0.99]">
            ← На головну
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">Доступність номерів</h1>
          <p className="mt-1 text-sm leading-5 text-neutral-600">Перевірка вільних номерів на потрібні дати та кількість гостей.</p>

          <form onSubmit={handleSearch} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Дата заїзду</span>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Дата виїзду</span>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Кількість гостей</span>
              <input type="number" min={1} max={20} value={guestsCount} onChange={(e) => setGuestsCount(Number(e.target.value))} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
            </label>

            <button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Перевірка...' : 'Перевірити'}
            </button>
          </form>
        </div>

        {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div> : null}

        {!searched && !loading && !error ? (
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm leading-5 text-neutral-600 shadow-sm">
            Вибери дати, вкажи кількість гостей і натисни “Перевірити”.
          </div>
        ) : null}

        {searched && !loading && !error && items.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm leading-5 text-neutral-600 shadow-sm">
            На вибрані дати вільних номерів не знайдено.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-3 space-y-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
            {items.map((item) => (
              <div key={item.room_id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold leading-tight">Номер {item.room_number}</div>
                    <div className="mt-1 truncate text-xs text-neutral-500">{item.building_name} · {item.room_type_name}</div>
                  </div>

                  <div className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                    {item.guests_count} гост.
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-700">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1">{item.nights} ноч.</span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1">доп. місць: {item.extra_beds_count}</span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-[11px] leading-4 text-neutral-500">
                    База: {formatMoney(item.price_base_total)}
                    <br />
                    Додаткові: {formatMoney(item.price_extra_total)}
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500">Вартість</div>
                    <div className="mt-1 text-xl font-bold leading-none">{formatMoney(item.price_total)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  )
}

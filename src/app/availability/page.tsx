'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DatePickerField } from '@/components/ui/date-picker-field'
import type { AvailabilityItem } from '@/types/availability'
import { addDays, addOneDay, dateInputToIso, getDatesInRange, getNights, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
import { getTotalGuestsCount, type GuestComposition } from '@/lib/guest-composition'

type ApiResponse = {
  ok: boolean
  items?: AvailabilityItem[]
  error?: string
}

const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5'
const primaryButtonClass =
  'h-12 w-full rounded-2xl bg-[var(--crm-wine)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)] disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-4 text-sm font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)] disabled:cursor-not-allowed disabled:opacity-60'
const counterButtonClass =
  'flex h-12 items-center justify-center rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] text-xl font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)]'
const counterPrimaryButtonClass =
  'flex h-12 items-center justify-center rounded-2xl bg-[var(--crm-wine)] text-xl font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)]'

function parseIntegerValue(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function getSearchComposition(adultsCount: number, childrenUnder6Count: number, children6PlusCount: number): GuestComposition {
  return {
    adultsCount: Math.max(0, adultsCount),
    childrenUnder6Count: Math.max(0, childrenUnder6Count),
    children6PlusCount: Math.max(0, children6PlusCount),
  }
}

function CompositionField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (nextValue: number) => void
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <div className="mt-1.5 grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className={counterButtonClass}>
          -
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={String(value)}
          onChange={(e) => onChange(parseIntegerValue(e.target.value))}
          className={`${fieldClass} mt-0 text-center font-semibold`}
        />
        <button type="button" onClick={() => onChange(value + 1)} className={counterPrimaryButtonClass}>
          +
        </button>
      </div>
    </label>
  )
}

function createBookingHref(
  item: AvailabilityItem,
  checkIn: string,
  checkOut: string,
  composition: GuestComposition
) {
  const guestsCount = getTotalGuestsCount(composition)
  const checkInIso = dateInputToIso(checkIn)
  const checkOutIso = dateInputToIso(checkOut)
  const params = new URLSearchParams({
    roomId: item.room_id,
    roomNumber: item.room_number,
    buildingName: item.building_name,
    roomTypeName: item.room_type_name,
    baseCapacity: String(item.base_capacity),
    maxCapacity: String(item.max_capacity),
    basePricePerNight: String(item.base_price_per_night),
    extraBedPricePerNight: String(item.extra_bed_price_per_night),
    checkIn: checkInIso,
    checkOut: checkOutIso,
    guestsCount: String(guestsCount),
    adultsCount: String(composition.adultsCount),
    childrenUnder6Count: String(composition.childrenUnder6Count),
    children6PlusCount: String(composition.children6PlusCount),
  })

  return `/bookings/new?${params.toString()}`
}

function getWeekdayShortLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(parsed)
}

function DailyAvailabilityTimeline({
  items,
  selectedDates,
  createHref,
}: {
  items: AvailabilityItem[]
  selectedDates: string[]
  createHref: (item: AvailabilityItem) => string
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-neutral-500 sm:hidden">Гортай стрічку вліво або вправо</div>
      <div className="mb-3 rounded-2xl bg-[var(--crm-panel)] px-3 py-3 text-sm leading-6 text-neutral-600">
        Бордові номери можна бронювати на весь вибраний період. Світлі номери вільні лише в окремі дні.
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 [touch-action:pan-x] [scrollbar-width:none] [-ms-overflow-style:none] sm:mx-0 sm:px-0">
        <div className="flex min-w-max snap-x snap-mandatory gap-2 sm:gap-3">
        {selectedDates.map((dateValue) => {
          const freeItems = items
            .filter((item) => item.free_dates.includes(dateValue))
            .sort((left, right) => left.room_number.localeCompare(right.room_number, 'uk-UA', { numeric: true }))

          return (
            <section
              key={dateValue}
              className="w-[172px] shrink-0 snap-start rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3 py-3 shadow-sm sm:w-[220px]"
            >
              <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
                <div className="text-base font-bold text-neutral-900 sm:text-lg">{isoDateToInputValue(dateValue)}</div>
                <div className="mt-1 text-sm font-medium lowercase text-[var(--crm-wine)]">{getWeekdayShortLabel(dateValue)}</div>
              </div>

              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {freeItems.length > 0 ? `${freeItems.length} вільн.` : 'Немає вільних'}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {freeItems.length > 0 ? (
                  freeItems.map((item) =>
                    item.is_fully_available ? (
                      <Link
                        key={`${dateValue}-${item.room_id}`}
                        href={createHref(item)}
                        className="rounded-full bg-[var(--crm-wine)] px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)] sm:text-sm"
                      >
                        {item.room_number}
                      </Link>
                    ) : (
                      <span
                        key={`${dateValue}-${item.room_id}`}
                        className="rounded-full border border-[var(--crm-vine-border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--crm-vine-dark)] shadow-sm sm:text-sm"
                      >
                        {item.room_number}
                      </span>
                    )
                  )
                ) : (
                  <div className="rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-neutral-500 shadow-sm">
                    У цей день вільних номерів немає.
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
      </div>
    </div>
  )
}

function SingleDayAvailabilityGrid({
  items,
  createHref,
}: {
  items: AvailabilityItem[]
  createHref: (item: AvailabilityItem) => string
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.room_id}
          href={createHref(item)}
          className="rounded-3xl border border-[var(--crm-wine-border)] bg-white/90 px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)] hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold leading-tight">Номер {item.room_number}</div>
              <div className="mt-1 text-xs leading-5 text-neutral-500">{item.building_name} · {item.room_type_name}</div>
            </div>
            <div className="rounded-full bg-[var(--crm-wine)] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
              {item.guests_count} гост.
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-700">
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">доп. місць: {item.extra_beds_count + item.free_extra_beds_count}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">вільний на {isoDateToInputValue(item.free_dates[0] || '')}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function AvailabilityPage() {
  const today = useMemo(() => isoDateToInputValue(getTodayDate()), [])
  const tomorrow = useMemo(() => isoDateToInputValue(addOneDay(getTodayDate())), [])

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [adultsCount, setAdultsCount] = useState(2)
  const [childrenUnder6Count, setChildrenUnder6Count] = useState(0)
  const [children6PlusCount, setChildren6PlusCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AvailabilityItem[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const searchComposition = useMemo(
    () => getSearchComposition(adultsCount, childrenUnder6Count, children6PlusCount),
    [adultsCount, childrenUnder6Count, children6PlusCount]
  )
  const guestsCount = getTotalGuestsCount(searchComposition)

  async function runSearch(
    nextCheckIn: string,
    nextCheckOut: string,
    composition: GuestComposition
  ) {
    setLoading(true)
    setError('')
    setItems([])
    setSearched(true)

    try {
      if (!isCompleteDateInput(nextCheckIn) || !isCompleteDateInput(nextCheckOut)) {
        throw new Error('Дати мають бути у форматі ДД-ММ-РРРР')
      }

      const checkInIso = dateInputToIso(nextCheckIn)
      const checkOutIso = dateInputToIso(nextCheckOut)

      if (!checkInIso || !checkOutIso) {
        throw new Error('Дати мають бути у форматі ДД-ММ-РРРР')
      }

      if (checkOutIso <= checkInIso) {
        throw new Error('Дата виїзду має бути пізніше за дату заїзду')
      }

      const nextGuestsCount = getTotalGuestsCount(composition)

      const params = new URLSearchParams({
        checkIn: checkInIso,
        checkOut: checkOutIso,
        guestsCount: String(nextGuestsCount),
        adultsCount: String(composition.adultsCount),
        childrenUnder6Count: String(composition.childrenUnder6Count),
        children6PlusCount: String(composition.children6PlusCount),
      })

      const response = await fetch(`/api/availability?${params.toString()}`)
      const rawText = await response.text()
      const data: ApiResponse = JSON.parse(rawText)

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося отримати доступні номери')
      }

      const nextItems = [...(data.items || [])].sort((left, right) => {
        if (left.is_fully_available !== right.is_fully_available) {
          return left.is_fully_available ? -1 : 1
        }

        if (left.is_fully_available && right.is_fully_available) {
          return left.price_total - right.price_total
        }

        if (left.free_dates_count !== right.free_dates_count) {
          return right.free_dates_count - left.free_dates_count
        }

        const leftDailyPrice = left.base_price_per_night + left.extra_bed_price_per_night * left.extra_beds_count
        const rightDailyPrice = right.base_price_per_night + right.extra_bed_price_per_night * right.extra_beds_count

        return leftDailyPrice - rightDailyPrice
      })

      setItems(nextItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await runSearch(checkIn, checkOut, searchComposition)
  }

  async function handleQuickPeriod(daysCount: number) {
    const nextCheckIn = isoDateToInputValue(getTodayDate())
    const nextCheckOut = isoDateToInputValue(addDays(getTodayDate(), daysCount))

    setCheckIn(nextCheckIn)
    setCheckOut(nextCheckOut)

    await runSearch(nextCheckIn, nextCheckOut, searchComposition)
  }

  const selectedCheckInIso = dateInputToIso(checkIn)
  const selectedCheckOutIso = dateInputToIso(checkOut)
  const selectedDates = useMemo(
    () => (selectedCheckInIso && selectedCheckOutIso ? getDatesInRange(selectedCheckInIso, selectedCheckOutIso) : []),
    [selectedCheckInIso, selectedCheckOutIso]
  )
  const showDailyBreakdown =
    Boolean(selectedCheckInIso) && Boolean(selectedCheckOutIso) && getNights(selectedCheckInIso, selectedCheckOutIso) > 1
  const availabilityDescription = showDailyBreakdown
    ? `Обраний період: ${checkIn} - ${checkOut}.`
    : `Вільні номери на дату ${checkIn}.`

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-3 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:items-start">
          <section className={`${sectionClass} lg:sticky lg:top-24`}>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Доступність номерів</h1>
            <form onSubmit={handleSearch} className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-neutral-800">Дата заїзду</span>
                  <DatePickerField
                    value={checkIn}
                    onChange={(value) => {
                      setCheckIn(value)
                    }}
                    className={fieldClass}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-neutral-800">Дата виїзду</span>
                  <DatePickerField
                    value={checkOut}
                    onChange={(value) => {
                      setCheckOut(value)
                    }}
                    className={fieldClass}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void handleQuickPeriod(7)} disabled={loading} className={secondaryButtonClass}>
                  Тиждень
                </button>
                <button type="button" onClick={() => void handleQuickPeriod(30)} disabled={loading} className={secondaryButtonClass}>
                  Місяць
                </button>
              </div>

              <div className="rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--crm-wine)]">Склад гостей</div>
                <div className="mt-3 grid gap-3">
                  <CompositionField label="Гості" value={adultsCount} onChange={setAdultsCount} />
                  <CompositionField label="Додаткові гості" value={children6PlusCount} onChange={setChildren6PlusCount} />
                  <CompositionField label="До 6 років" value={childrenUnder6Count} onChange={setChildrenUnder6Count} />
                </div>
                <div className="mt-4 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-neutral-700 shadow-sm">
                  <div className="mt-1">Всього: {guestsCount}</div>
                </div>
              </div>

              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? 'Перевірка...' : 'Перевірити доступність'}
              </button>
            </form>
          </section>

          <section className="space-y-3">
            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 shadow-sm sm:px-5">
                {error}
              </div>
            ) : null}

            {!searched && !loading && !error ? (
              <div className={`${sectionClass} text-sm leading-6 text-neutral-600`}>
                Вибери дати, вкажи кількість гостей і натисни “Перевірити доступність”.
              </div>
            ) : null}

            {searched && !loading && !error && items.length === 0 ? (
              <div className={`${sectionClass} text-sm leading-6 text-neutral-600`}>
                На вибрані дати вільних номерів не знайдено.
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className={sectionClass}>
                <div className="flex flex-col gap-1 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-neutral-900">{showDailyBreakdown ? 'Вільні номери по днях' : 'Вільні номери'}</div>
                    <div className="text-sm text-neutral-600">{availabilityDescription}</div>
                  </div>
                  <div className="text-sm font-medium text-neutral-500">{showDailyBreakdown ? `${selectedDates.length} дн.` : `${items.length} номер(и)`}</div>
                </div>

                <div className="mt-4">
                  {showDailyBreakdown ? (
                    <DailyAvailabilityTimeline
                      items={items}
                      selectedDates={selectedDates}
                      createHref={(item) => createBookingHref(item, checkIn, checkOut, searchComposition)}
                    />
                  ) : (
                    <SingleDayAvailabilityGrid
                      items={items.filter((item) => item.is_fully_available)}
                      createHref={(item) => createBookingHref(item, checkIn, checkOut, searchComposition)}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

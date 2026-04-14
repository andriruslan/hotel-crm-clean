'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getVisibleGuestName } from '@/components/bookings/arrival-shared'
import { DatePickerField } from '@/components/ui/date-picker-field'
import type { PaymentStatus } from '@/constants/payment-status'
import { dateInputToIso, formatDateForDisplay, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
import { groupDepartureItems, type DepartureGroup, type DepartureGroupItem } from '@/lib/departure-groups'
import { normalizePhone } from '@/lib/phone'
import { getPaymentStatus, getPaymentStatusLabel } from '@/lib/payment-status'

type DeparturesResponse = {
  ok: boolean
  items?: DepartureGroupItem[]
  error?: string
}

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5'
const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-4 text-sm font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'

type DepartureDisplayGroup = DepartureGroup

function formatMoney(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value)
}

function matchesSearch(group: DepartureDisplayGroup, search: string) {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  const digitsSearch = normalizedSearch.replace(/\D/g, '')
  const phoneValue = normalizePhone(group.guest_phone || '')
  const phoneDigits = phoneValue.replace(/\D/g, '')

  return (
    group.guest_name.toLowerCase().includes(normalizedSearch) ||
    phoneValue.toLowerCase().includes(normalizedSearch) ||
    group.room_numbers.some((roomNumber) => roomNumber.toLowerCase().includes(normalizedSearch)) ||
    (digitsSearch.length > 0 && phoneDigits.includes(digitsSearch))
  )
}

function getPaymentBadgeClass(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return 'bg-[var(--crm-vine)] text-white'
    case 'partial':
      return 'bg-amber-100 text-amber-900'
    case 'unpaid':
    default:
      return 'bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]'
  }
}

function getRoomCardsGridClass(itemsCount: number) {
  if (itemsCount <= 1) {
    return 'mt-4 grid gap-3'
  }

  if (itemsCount === 2) {
    return 'mt-4 grid gap-3 xl:grid-cols-2'
  }

  return 'mt-4 grid gap-3 lg:grid-cols-2'
}

function createDepartureDisplayGroup(
  group: DepartureGroup,
  filter: (item: DepartureGroupItem) => boolean
): DepartureDisplayGroup | null {
  const nextItems = group.items.filter(filter)

  if (nextItems.length === 0) {
    return null
  }

  const totalPrice = nextItems.reduce((sum, item) => sum + Number(item.price_total || 0), 0)
  const totalCashAmount = nextItems.reduce((sum, item) => sum + Number(item.payment_cash_amount || 0), 0)
  const totalCardAmount = nextItems.reduce((sum, item) => sum + Number(item.payment_card_amount || 0), 0)
  const totalPaid = nextItems.reduce((sum, item) => sum + Number(item.payment_total_received || 0), 0)

  return {
    ...group,
    items: nextItems,
    room_numbers: Array.from(new Set(nextItems.map((item) => item.room_number))),
    total_guests_count: nextItems.reduce((sum, item) => sum + Number(item.guests_count || 0), 0),
    total_price: totalPrice,
    total_cash_amount: totalCashAmount,
    total_card_amount: totalCardAmount,
    total_paid: totalPaid,
    total_balance: Math.max(0, totalPrice - totalPaid),
    payment_status: getPaymentStatus(totalPrice, totalPaid),
    occupancy_status: nextItems.every((item) => item.occupancy_status === 'checked_out') ? 'checked_out' : 'checked_in',
    booking_note: group.booking_note || nextItems.find((item) => item.booking_note)?.booking_note || '',
    payment_due_stage: nextItems[0]?.payment_due_stage || group.payment_due_stage,
  }
}

function DepartureBookingCard({
  group,
  fullGroup,
  appliedDate,
}: {
  group: DepartureDisplayGroup
  fullGroup: DepartureGroup
  appliedDate: string
}) {
  const hasOtherRoomsOutsideSection = fullGroup.items.length !== group.items.length
  const hasMultipleRoomsInBooking = fullGroup.room_numbers.length > 1
  const visibleGuestName = getVisibleGuestName(group.guest_name)

  if (!hasMultipleRoomsInBooking) {
    const item = group.items[0]

    if (!item) {
      return null
    }

    const totalPaid = Number(item.payment_total_received || 0)
    const totalPrice = Number(item.price_total || 0)
    const balance = Math.max(0, totalPrice - totalPaid)

    return (
      <Link
        href={`/bookings/departures/${item.id}?date=${encodeURIComponent(appliedDate)}`}
        className="block rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-3.5 py-3.5 text-left shadow-sm transition hover:border-[var(--crm-wine)] hover:shadow-md sm:px-5 sm:py-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-base font-bold text-neutral-900 sm:text-lg">{normalizePhone(group.guest_phone || '') || 'Телефон не вказано'}</div>
            {visibleGuestName ? <div className="mt-1 text-sm text-neutral-700">{visibleGuestName}</div> : null}
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentBadgeClass(group.payment_status)}`}>
            {getPaymentStatusLabel(group.payment_status)}
          </span>
        </div>

        <div className="mt-4 rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3.5 py-3.5 shadow-sm sm:px-4 sm:py-4">
          <div className="min-w-0">
            <div className="text-xl font-bold leading-tight text-neutral-900 sm:text-2xl">Номер {item.room_number}</div>
            <div className="mt-1 text-sm leading-5 text-neutral-500">{item.building_name || 'Без корпусу'}</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-700">
            <span className="rounded-full bg-white/95 px-2.5 py-1 shadow-sm">{item.guests_count} гост.</span>
          </div>

          <div className="mt-4 rounded-2xl bg-white/90 px-3 py-3 text-sm leading-6 text-neutral-500 shadow-sm">
            <div>Заїзд: {formatDateForDisplay(item.check_in_date)}</div>
            <div>Виїзд: {formatDateForDisplay(item.check_out_date)}</div>
            <div>До оплати: {formatMoney(balance)}</div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-base font-bold text-neutral-900 sm:text-lg">{normalizePhone(group.guest_phone || '') || 'Телефон не вказано'}</div>
          {visibleGuestName ? <div className="mt-1 text-sm text-neutral-700">{visibleGuestName}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {fullGroup.booking_group_id ? (
            <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">{fullGroup.booking_group_id}</span>
          ) : null}
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentBadgeClass(group.payment_status)}`}>
            {getPaymentStatusLabel(group.payment_status)}
          </span>
        </div>
      </div>

      {hasMultipleRoomsInBooking ? (
        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">У замовленні</div>
            <div className="mt-1 font-semibold text-neutral-900">{fullGroup.room_numbers.length} номерів</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">У цьому блоці</div>
            <div className="mt-1 font-semibold text-neutral-900">{group.room_numbers.length} номерів</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Загальний залишок</div>
            <div className="mt-1 font-semibold text-neutral-900">{formatMoney(fullGroup.total_balance)}</div>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">У цьому блоці</div>
            <div className="mt-1 font-semibold text-neutral-900">{formatMoney(group.total_balance)}</div>
          </div>
        </div>
      ) : null}

      {hasMultipleRoomsInBooking ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {fullGroup.items.map((item) => (
            <span
              key={item.id}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${item.occupancy_status === 'checked_out' ? 'bg-[var(--crm-vine)] text-white' : 'bg-[var(--crm-wine-soft)] text-[var(--crm-wine)]'}`}
            >
              {item.room_number}
            </span>
          ))}
        </div>
      ) : null}

      {hasMultipleRoomsInBooking && hasOtherRoomsOutsideSection ? (
        <div className="mt-3 rounded-2xl bg-neutral-100 px-3 py-3 text-sm text-neutral-700">
          У цьому замовленні є ще номери в іншому блоці цього екрана.
        </div>
      ) : null}

      {hasMultipleRoomsInBooking && group.booking_note ? (
        <div className="mt-3 rounded-2xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">{group.booking_note}</div>
      ) : null}

      <div className={getRoomCardsGridClass(group.items.length)}>
        {group.items.map((item) => {
          const totalPaid = Number(item.payment_total_received || 0)
          const totalPrice = Number(item.price_total || 0)
          const balance = Math.max(0, totalPrice - totalPaid)

          return (
            <Link
              key={item.id}
              href={`/bookings/departures/${item.id}?date=${encodeURIComponent(appliedDate)}`}
              className="block w-full rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3.5 py-3.5 text-left shadow-sm transition hover:border-[var(--crm-wine)] hover:shadow-md sm:px-4 sm:py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-bold leading-tight text-neutral-900 sm:text-xl">Номер {item.room_number}</div>
                  <div className="mt-1 text-sm leading-5 text-neutral-500">{item.building_name || 'Без корпусу'}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-700">
                <span className={`rounded-full px-2.5 py-1 shadow-sm ${getPaymentBadgeClass(item.payment_status)}`}>
                  {getPaymentStatusLabel(item.payment_status)}
                </span>
                <span className="rounded-full bg-white/95 px-2.5 py-1 shadow-sm">{item.guests_count} гост.</span>
              </div>

              <div className="mt-4 rounded-2xl bg-white/90 px-3 py-3 text-sm leading-6 text-neutral-500 shadow-sm">
                <div>Заїзд: {formatDateForDisplay(item.check_in_date)}</div>
                <div>Виїзд: {formatDateForDisplay(item.check_out_date)}</div>
                <div>До оплати: {formatMoney(balance)}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function DeparturesGroups({ initialDate = '' }: { initialDate?: string }) {
  const today = useMemo(() => isoDateToInputValue(getTodayDate()), [])
  const defaultDate = isCompleteDateInput(initialDate) ? initialDate : today
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [appliedDate, setAppliedDate] = useState(defaultDate)
  const [searchValue, setSearchValue] = useState('')
  const [items, setItems] = useState<DepartureGroupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isCompleteDateInput(appliedDate)) {
      setItems([])
      return
    }

    let isCancelled = false

    async function loadDepartures() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/bookings/departures-today?date=${encodeURIComponent(dateInputToIso(appliedDate))}`)
        const data: DeparturesResponse = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Не вдалося отримати список виїздів')
        }

        if (!isCancelled) {
          setItems(data.items || [])
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Сталася помилка')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    void loadDepartures()

    return () => {
      isCancelled = true
    }
  }, [appliedDate])

  const groups = useMemo(() => groupDepartureItems(items), [items])
  const pendingGroups = useMemo(
    () =>
      groups
        .map((group) => ({ fullGroup: group, displayGroup: createDepartureDisplayGroup(group, (item) => item.occupancy_status !== 'checked_out') }))
        .filter((entry): entry is { fullGroup: DepartureGroup; displayGroup: DepartureDisplayGroup } => Boolean(entry.displayGroup))
        .filter((entry) => matchesSearch(entry.displayGroup, searchValue)),
    [groups, searchValue]
  )
  const checkedOutGroups = useMemo(
    () =>
      groups
        .map((group) => ({ fullGroup: group, displayGroup: createDepartureDisplayGroup(group, (item) => item.occupancy_status === 'checked_out') }))
        .filter((entry): entry is { fullGroup: DepartureGroup; displayGroup: DepartureDisplayGroup } => Boolean(entry.displayGroup))
        .filter((entry) => matchesSearch(entry.displayGroup, searchValue)),
    [groups, searchValue]
  )

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:items-start">
          <section className={`${sectionClass} xl:sticky xl:top-24`}>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Виїзди</h1>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-neutral-800">Дата</span>
                <DatePickerField value={selectedDate} onChange={setSelectedDate} className={fieldClass} />
              </label>

              <button
                type="button"
                onClick={() => setAppliedDate(selectedDate)}
                disabled={!isCompleteDateInput(selectedDate)}
                className={secondaryButtonClass}
              >
                Сформувати
              </button>

              <label className="block">
                <span className="text-sm font-medium text-neutral-800">Пошук гостя або номера</span>
                <input type="text" inputMode="search" placeholder="Телефон, ПІБ або номер" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className={fieldClass} />
              </label>

              <button
                type="button"
                onClick={() => {
                  setSelectedDate(today)
                  setAppliedDate(today)
                  setSearchValue('')
                }}
                className={secondaryButtonClass}
              >
                Скинути фільтри
              </button>
            </div>
          </section>

          <section className="space-y-3">
            {error ? <div className="rounded-3xl border border-[var(--crm-danger)] bg-[var(--crm-danger-soft)] px-4 py-3 text-sm text-[var(--crm-danger)]">{error}</div> : null}

            <div className={sectionClass}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-neutral-900">Очікують виїзд</div>
                </div>
                <div className="rounded-full bg-[var(--crm-wine-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--crm-wine)]">{pendingGroups.length}</div>
              </div>

              {loading ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Завантаження виїздів...</div>
              ) : pendingGroups.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Немає номерів, які очікують виїзду.</div>
              ) : (
                <div className="mt-4 grid items-start gap-3 2xl:grid-cols-2">
                  {pendingGroups.map(({ fullGroup, displayGroup }) => (
                    <DepartureBookingCard
                      key={`${displayGroup.id}-pending`}
                      group={displayGroup}
                      fullGroup={fullGroup}
                      appliedDate={appliedDate}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[var(--crm-vine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--crm-vine-dark)]">Виселені</div>
                </div>
                <div className="rounded-full bg-[var(--crm-vine)] px-3 py-1.5 text-sm font-semibold text-white">{checkedOutGroups.length}</div>
              </div>

              {loading ? null : checkedOutGroups.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-[var(--crm-vine-soft)] px-4 py-4 text-sm text-[var(--crm-vine-dark)]">Поки немає номерів, які вже виселили на цю дату.</div>
              ) : (
                <div className="mt-4 grid items-start gap-3 2xl:grid-cols-2">
                  {checkedOutGroups.map(({ fullGroup, displayGroup }) => (
                    <DepartureBookingCard
                      key={`${displayGroup.id}-checked-out`}
                      group={displayGroup}
                      fullGroup={fullGroup}
                      appliedDate={appliedDate}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

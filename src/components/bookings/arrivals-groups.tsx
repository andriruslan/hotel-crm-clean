'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getVisibleGuestName } from '@/components/bookings/arrival-shared'
import { DatePickerField } from '@/components/ui/date-picker-field'
import type { PaymentStatus } from '@/constants/payment-status'
import { dateInputToIso, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
import type { ArrivalGroupItem } from '@/lib/arrival-groups'
import { normalizePhone } from '@/lib/phone'
import { getPaymentStatusLabel } from '@/lib/payment-status'

type ArrivalsResponse = {
  ok: boolean
  items?: ArrivalGroupItem[]
  error?: string
}

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5'
const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'
const compactActionButtonClass =
  'inline-flex h-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'

function matchesSearch(item: ArrivalGroupItem, search: string) {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  const digitsSearch = normalizedSearch.replace(/\D/g, '')
  const phoneValue = normalizePhone(item.guest_phone || '')
  const phoneDigits = phoneValue.replace(/\D/g, '')
  const guestName = (item.guest_name || '').trim().toLowerCase()
  const roomNumber = (item.room_number || '').trim().toLowerCase()

  return (
    guestName.includes(normalizedSearch) ||
    phoneValue.toLowerCase().includes(normalizedSearch) ||
    roomNumber.includes(normalizedSearch) ||
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
      return 'bg-[var(--crm-wine-soft)] text-[var(--crm-wine)]'
  }
}

function getPreviewCardsGridClass(itemsCount: number) {
  if (itemsCount <= 0) {
    return 'mt-4'
  }

  return 'mt-4 flex flex-wrap items-start gap-3'
}

function buildDuplicateGuestMap(items: ArrivalGroupItem[]) {
  const counts = new Map<string, number>()

  for (const item of items) {
    const phoneKey = normalizePhone(item.guest_phone || '')
    const nameKey = (item.guest_name || '').trim().toLowerCase()

    if (!phoneKey && !nameKey) {
      continue
    }

    const combinedKey = `${phoneKey}::${nameKey}`
    counts.set(combinedKey, (counts.get(combinedKey) || 0) + 1)
  }

  return counts
}

function getDuplicateGuestKey(item: ArrivalGroupItem) {
  return `${normalizePhone(item.guest_phone || '')}::${(item.guest_name || '').trim().toLowerCase()}`
}

function ArrivalBookingCard({
  item,
  appliedDate,
  showRoomHint,
}: {
  item: ArrivalGroupItem
  appliedDate: string
  showRoomHint: boolean
}) {
  const visibleGuestName = getVisibleGuestName(item.guest_name)

  return (
    <Link
      href={`/bookings/arrivals/${item.id}?date=${encodeURIComponent(appliedDate)}`}
      className={`block w-full self-start min-[700px]:w-[calc(50%-0.375rem)] min-[1180px]:w-[calc(33.333%-0.5rem)] min-[1480px]:w-[calc(25%-0.5625rem)] rounded-3xl border-2 px-3 py-3 text-left shadow-[0_10px_24px_rgba(143,45,86,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg sm:px-3.5 sm:py-3.5 ${
        item.occupancy_status === 'checked_in'
          ? 'border-[var(--crm-vine-border)] bg-[var(--crm-vine-soft)] hover:border-[var(--crm-vine-dark)]'
          : 'border-[var(--crm-wine-border)] bg-white/95 hover:border-[var(--crm-wine)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="whitespace-nowrap text-base font-bold text-neutral-900 sm:text-lg">{normalizePhone(item.guest_phone || '') || 'Телефон не вказано'}</div>
          {visibleGuestName ? <div className="mt-1 break-words text-sm leading-5 text-neutral-700">{visibleGuestName}</div> : null}
          {showRoomHint ? <div className="mt-2 text-xs font-medium text-neutral-500">{`Номер ${item.room_number}`}</div> : null}
        </div>

        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentBadgeClass(item.payment_status)}`}>
          {getPaymentStatusLabel(item.payment_status)}
        </span>
      </div>
    </Link>
  )
}

export function ArrivalsGroups({ initialDate = '' }: { initialDate?: string }) {
  const today = useMemo(() => isoDateToInputValue(getTodayDate()), [])
  const defaultDate = isCompleteDateInput(initialDate) ? initialDate : today
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [appliedDate, setAppliedDate] = useState(defaultDate)
  const [searchValue, setSearchValue] = useState('')
  const [items, setItems] = useState<ArrivalGroupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isCompleteDateInput(appliedDate)) {
      setItems([])
      return
    }

    let isCancelled = false

    async function loadArrivals() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/bookings/arrivals-today?date=${encodeURIComponent(dateInputToIso(appliedDate))}`)
        const data: ArrivalsResponse = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Не вдалося отримати список заїздів')
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

    void loadArrivals()

    return () => {
      isCancelled = true
    }
  }, [appliedDate])

  const pendingItems = useMemo(
    () => items.filter((item) => item.occupancy_status !== 'checked_in').filter((item) => matchesSearch(item, searchValue)),
    [items, searchValue]
  )
  const checkedInItems = useMemo(
    () => items.filter((item) => item.occupancy_status === 'checked_in').filter((item) => matchesSearch(item, searchValue)),
    [items, searchValue]
  )
  const totalArrivalsCount = items.length
  const totalCheckedInCount = useMemo(
    () => items.filter((item) => item.occupancy_status === 'checked_in').length,
    [items]
  )
  const totalPendingCount = Math.max(0, totalArrivalsCount - totalCheckedInCount)
  const checkedInProgressPercent = totalArrivalsCount > 0 ? Math.round((totalCheckedInCount / totalArrivalsCount) * 100) : 0
  const duplicateGuestMap = useMemo(() => buildDuplicateGuestMap(items), [items])

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:items-start">
          <section className={`${sectionClass} xl:sticky xl:top-24`}>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Заїзди</h1>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <label className="block min-w-0">
                  <span className="text-sm font-medium text-neutral-800">Дата заселення</span>
                  <DatePickerField value={selectedDate} onChange={setSelectedDate} className={fieldClass} />
                </label>
                <button
                  type="button"
                  onClick={() => setAppliedDate(selectedDate)}
                  disabled={!isCompleteDateInput(selectedDate)}
                  className={compactActionButtonClass}
                >
                  Сформувати
                </button>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-neutral-800">Пошук гостя або номера</span>
                <input
                  type="text"
                  inputMode="search"
                  placeholder="Телефон, ПІБ або номер"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className={fieldClass}
                />
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

            <div className="rounded-3xl border border-[var(--crm-vine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{'\u0417\u0430\u0457\u0437\u0434\u0438 \u043d\u0430 \u0446\u044e \u0434\u0430\u0442\u0443'}</div>
                  <div className="mt-1 text-sm text-neutral-600">{`${totalCheckedInCount} \u0456\u0437 ${totalArrivalsCount} \u0437\u0430\u0441\u0435\u043b\u0435\u043d\u043e`}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[var(--crm-vine-dark)]">{`${checkedInProgressPercent}%`}</div>
                  <div className="text-xs font-medium text-neutral-500">{`${totalPendingCount} \u043e\u0447\u0456\u043a\u0443\u044e\u0442\u044c`}</div>
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--crm-vine-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--crm-vine)] transition-all"
                  style={{ width: `${checkedInProgressPercent}%` }}
                />
              </div>
            </div>

            <div className={sectionClass}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-neutral-900">Очікують заселення</div>
                </div>
                <div className="rounded-full bg-[var(--crm-wine-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--crm-wine)]">{pendingItems.length}</div>
              </div>

              {loading ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Завантаження заїздів...</div>
              ) : pendingItems.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Немає номерів, які очікують заселення.</div>
              ) : (
                <div className={getPreviewCardsGridClass(pendingItems.length)}>
                  {pendingItems.map((item) => (
                    <ArrivalBookingCard
                      key={`${item.id}-pending`}
                      item={item}
                      appliedDate={appliedDate}
                      showRoomHint={(duplicateGuestMap.get(getDuplicateGuestKey(item)) || 0) > 1}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[var(--crm-vine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--crm-vine-dark)]">Заселені</div>
                </div>
                <div className="rounded-full bg-[var(--crm-vine)] px-3 py-1.5 text-sm font-semibold text-white">{checkedInItems.length}</div>
              </div>

              {loading ? null : checkedInItems.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-[var(--crm-vine-soft)] px-4 py-4 text-sm text-[var(--crm-vine-dark)]">Поки немає номерів, які вже заселили на цю дату.</div>
              ) : (
                <div className={getPreviewCardsGridClass(checkedInItems.length)}>
                  {checkedInItems.map((item) => (
                    <ArrivalBookingCard
                      key={`${item.id}-checked-in`}
                      item={item}
                      appliedDate={appliedDate}
                      showRoomHint={(duplicateGuestMap.get(getDuplicateGuestKey(item)) || 0) > 1}
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

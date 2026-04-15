'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PaymentStatus } from '@/constants/payment-status'
import { getPaymentDueStageLabel, type PaymentDueStage } from '@/lib/booking-note-meta'
import { formatDateForDisplay, getTodayDate } from '@/lib/dates'
import { normalizePhone } from '@/lib/phone'
import { getPaymentStatusLabel } from '@/lib/payment-status'

type PaymentControlItem = {
  id: string
  room_id: string
  room_number: string
  building_name: string
  guest_id: string
  guest_name: string
  guest_phone: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  booking_note: string
  visible_note: string
  booking_group_id: string
  payment_due_stage: PaymentDueStage
  reserve_until_date: string
  last_reminder_at: string
  created_at: string
  price_total: number
  payment_cash_amount: number
  payment_card_amount: number
  payment_total_received: number
  payment_status: PaymentStatus
  payment_progress_percent: number
  status: 'new' | 'confirmed' | 'canceled' | 'completed'
  occupancy_status: 'not_checked_in' | 'checked_in' | 'checked_out'
  is_reserve_expired: boolean
}

type PaymentControlResponse = {
  ok: boolean
  items?: PaymentControlItem[]
  error?: string
}

type UpdateResponse = {
  ok: boolean
  error?: string
}

type PaymentResponse = {
  ok: boolean
  error?: string
}

type PaymentControlGroup = {
  id: string
  booking_group_id: string
  guest_name: string
  guest_phone: string
  room_numbers: string[]
  total_price: number
  total_paid: number
  total_balance: number
  expired_count: number
  items: PaymentControlItem[]
}

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5'
const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'
const primaryButtonClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)] disabled:opacity-60'
const warnButtonClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-[#946222] bg-[var(--crm-warning)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(185,122,42,0.22)] transition hover:bg-[#946222] disabled:opacity-60'
const dangerButtonClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-[#973b3b] bg-[var(--crm-danger)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(179,72,72,0.22)] transition hover:bg-[#973b3b] disabled:opacity-60'

function parseIntegerValue(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '')
}

function getVisibleGuestName(value: string | null | undefined) {
  const normalizedValue = (value || '').trim()
  return normalizedValue && normalizedValue !== 'Гість без ПІБ' ? normalizedValue : ''
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(value: string) {
  if (!value) {
    return 'Ще не нагадували'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
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

function getBookingStatusLabel(status: PaymentControlItem['status']) {
  switch (status) {
    case 'confirmed':
      return 'Підтверджене'
    case 'canceled':
      return 'Скасоване'
    case 'completed':
      return 'Завершене'
    case 'new':
    default:
      return 'Нове'
  }
}

function groupPaymentItems(items: PaymentControlItem[]) {
  const groups = new Map<string, PaymentControlGroup>()

  for (const item of items) {
    const groupId = item.booking_group_id || item.id
    const currentGroup = groups.get(groupId)

    if (!currentGroup) {
      groups.set(groupId, {
        id: groupId,
        booking_group_id: item.booking_group_id,
        guest_name: item.guest_name,
        guest_phone: item.guest_phone,
        room_numbers: [item.room_number],
        total_price: Number(item.price_total || 0),
        total_paid: Number(item.payment_total_received || 0),
        total_balance: Math.max(0, Number(item.price_total || 0) - Number(item.payment_total_received || 0)),
        expired_count: item.is_reserve_expired ? 1 : 0,
        items: [item],
      })
      continue
    }

    currentGroup.items.push(item)

    if (!currentGroup.room_numbers.includes(item.room_number)) {
      currentGroup.room_numbers.push(item.room_number)
    }

    currentGroup.total_price += Number(item.price_total || 0)
    currentGroup.total_paid += Number(item.payment_total_received || 0)
    currentGroup.total_balance = Math.max(0, currentGroup.total_price - currentGroup.total_paid)
    currentGroup.expired_count += item.is_reserve_expired ? 1 : 0
  }

  return Array.from(groups.values())
}

function createDisplayGroup(
  group: PaymentControlGroup,
  filter: (item: PaymentControlItem) => boolean
): PaymentControlGroup | null {
  const nextItems = group.items.filter(filter)

  if (nextItems.length === 0) {
    return null
  }

  const totalPrice = nextItems.reduce((sum, item) => sum + Number(item.price_total || 0), 0)
  const totalPaid = nextItems.reduce((sum, item) => sum + Number(item.payment_total_received || 0), 0)

  return {
    ...group,
    items: nextItems,
    room_numbers: Array.from(new Set(nextItems.map((item) => item.room_number))),
    total_price: totalPrice,
    total_paid: totalPaid,
    total_balance: Math.max(0, totalPrice - totalPaid),
    expired_count: nextItems.filter((item) => item.is_reserve_expired).length,
  }
}

function ReservationRoomCard({
  item,
  savingKey,
  onAddPayment,
  onMarkReminder,
  onCancelBooking,
}: {
  item: PaymentControlItem
  savingKey: string
  onAddPayment: (bookingId: string, cashAmount: number, cardAmount: number) => Promise<boolean>
  onMarkReminder: (bookingId: string) => Promise<boolean>
  onCancelBooking: (bookingId: string) => Promise<boolean>
}) {
  const [cashValue, setCashValue] = useState('')
  const [cardValue, setCardValue] = useState('')
  const [isCancelConfirmVisible, setIsCancelConfirmVisible] = useState(false)
  const balance = Math.max(0, Number(item.price_total || 0) - Number(item.payment_total_received || 0))
  const isBusy = savingKey.startsWith(`${item.id}:`)

  async function handleAddPaymentClick() {
    const ok = await onAddPayment(item.id, parseIntegerValue(cashValue), parseIntegerValue(cardValue))

    if (ok) {
      setCashValue('')
      setCardValue('')
    }
  }

  async function handleCancelClick() {
    const ok = await onCancelBooking(item.id)

    if (ok) {
      setIsCancelConfirmVisible(false)
    }
  }

  return (
    <article className={`rounded-3xl border px-4 py-4 shadow-sm ${item.is_reserve_expired ? 'border-[var(--crm-danger)] bg-[var(--crm-danger-soft)]' : 'border-[var(--crm-wine-border)] bg-[var(--crm-panel)]'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-bold text-neutral-900">Номер {item.room_number}</div>
          <div className="mt-1 text-sm text-neutral-600">{item.building_name || 'Без корпусу'}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.is_reserve_expired ? (
            <span className="rounded-full bg-[var(--crm-danger)] px-3 py-1.5 text-xs font-semibold text-white">Термін резерву вийшов</span>
          ) : null}
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentBadgeClass(item.payment_status)}`}>
            {getPaymentStatusLabel(item.payment_status)}
          </span>
          <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            {getBookingStatusLabel(item.status)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Заїзд</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatDateForDisplay(item.check_in_date)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Виїзд</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatDateForDisplay(item.check_out_date)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Гостей</div>
          <div className="mt-1 font-semibold text-neutral-900">{item.guests_count}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплата очікується</div>
          <div className="mt-1 font-semibold text-neutral-900">{getPaymentDueStageLabel(item.payment_due_stage)}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Вартість</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(item.price_total)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплачено</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(item.payment_total_received)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Покриття</div>
          <div className="mt-1 font-semibold text-neutral-900">{item.payment_progress_percent}%</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Залишок</div>
          <div className={`mt-1 font-semibold ${balance > 0 ? 'text-[var(--crm-wine)]' : 'text-[var(--crm-vine-dark)]'}`}>{formatMoney(balance)}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Резерв до оплати</div>
          <div className={`mt-1 font-semibold ${item.is_reserve_expired ? 'text-[var(--crm-danger)]' : 'text-neutral-900'}`}>
            {item.reserve_until_date ? formatDateForDisplay(item.reserve_until_date) : 'Не встановлено'}
          </div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Останнє нагадування</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatDateTime(item.last_reminder_at)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm sm:col-span-2 xl:col-span-1">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Створено</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatDateForDisplay(item.created_at ? item.created_at.slice(0, 10) : getTodayDate())}</div>
        </div>
      </div>

      {item.booking_note ? <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">{item.booking_note}</div> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-neutral-800">Готівка, грн</span>
          <input type="text" inputMode="numeric" value={cashValue} onChange={(e) => setCashValue(sanitizeIntegerInput(e.target.value))} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-800">Картка, грн</span>
          <input type="text" inputMode="numeric" value={cardValue} onChange={(e) => setCardValue(sanitizeIntegerInput(e.target.value))} className={fieldClass} />
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={handleAddPaymentClick}
          disabled={isBusy || balance <= 0 || (parseIntegerValue(cashValue) <= 0 && parseIntegerValue(cardValue) <= 0)}
          className={primaryButtonClass}
        >
          {isBusy ? 'Збереження...' : balance > 0 ? 'Зберегти оплату' : 'Оплачено повністю'}
        </button>

        <button type="button" onClick={() => void onMarkReminder(item.id)} disabled={isBusy} className={warnButtonClass}>
          {isBusy ? 'Оновлення...' : 'Позначити нагадування'}
        </button>

        {isCancelConfirmVisible ? (
          <>
            <button type="button" onClick={handleCancelClick} disabled={isBusy} className={dangerButtonClass}>
              {isBusy ? 'Скасування...' : 'Підтвердити скасування'}
            </button>
            <button type="button" onClick={() => setIsCancelConfirmVisible(false)} disabled={isBusy} className={secondaryButtonClass}>
              Не скасовувати
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setIsCancelConfirmVisible(true)} disabled={isBusy} className={dangerButtonClass}>
            Скасувати бронювання
          </button>
        )}
      </div>
    </article>
  )
}

function ReservationGroupCard({
  group,
  fullGroup,
  savingKey,
  onAddPayment,
  onMarkReminder,
  onCancelBooking,
}: {
  group: PaymentControlGroup
  fullGroup: PaymentControlGroup
  savingKey: string
  onAddPayment: (bookingId: string, cashAmount: number, cardAmount: number) => Promise<boolean>
  onMarkReminder: (bookingId: string) => Promise<boolean>
  onCancelBooking: (bookingId: string) => Promise<boolean>
}) {
  const hasOtherRoomsOutsideSection = group.items.length !== fullGroup.items.length
  const visibleGuestName = getVisibleGuestName(group.guest_name)

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {visibleGuestName ? <div className="text-lg font-bold text-neutral-900">{visibleGuestName}</div> : null}
          <div className="mt-1 text-sm text-neutral-600">{normalizePhone(group.guest_phone || '') || 'Телефон не вказано'}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {fullGroup.booking_group_id ? (
            <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">{fullGroup.booking_group_id}</span>
          ) : null}
          {group.expired_count > 0 ? (
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Прострочено: {group.expired_count}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-neutral-50 px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">У замовленні</div>
          <div className="mt-1 font-semibold text-neutral-900">{fullGroup.room_numbers.length} номерів</div>
        </div>
        <div className="rounded-2xl bg-neutral-50 px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">У цьому блоці</div>
          <div className="mt-1 font-semibold text-neutral-900">{group.room_numbers.length} номерів</div>
        </div>
        <div className="rounded-2xl bg-neutral-50 px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплачено</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(group.total_paid)}</div>
        </div>
        <div className="rounded-2xl bg-neutral-50 px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Залишок</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(group.total_balance)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {fullGroup.items.map((item) => (
          <span
            key={item.id}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${item.is_reserve_expired ? 'bg-[var(--crm-danger)] text-white' : item.payment_status === 'paid' ? 'bg-[var(--crm-vine)] text-white' : 'bg-[var(--crm-wine-soft)] text-[var(--crm-wine)]'}`}
          >
            {item.room_number}
          </span>
        ))}
      </div>

      {hasOtherRoomsOutsideSection ? (
        <div className="mt-3 rounded-2xl bg-neutral-100 px-3 py-3 text-sm text-neutral-700">
          У цьому замовленні є ще номери в іншому блоці цього екрана.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {group.items.map((item) => (
          <ReservationRoomCard
            key={item.id}
            item={item}
            savingKey={savingKey}
            onAddPayment={onAddPayment}
            onMarkReminder={onMarkReminder}
            onCancelBooking={onCancelBooking}
          />
        ))}
      </div>
    </section>
  )
}

export function PaymentControlPage() {
  const [searchValue, setSearchValue] = useState('')
  const [items, setItems] = useState<PaymentControlItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savingKey, setSavingKey] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isCancelled = false

    async function loadItems() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/bookings/payment-control?q=${encodeURIComponent(searchValue.trim())}`)
        const data: PaymentControlResponse = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Не вдалося отримати список бронювань')
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

    void loadItems()

    return () => {
      isCancelled = true
    }
  }, [searchValue, reloadToken])

  async function savePayment(bookingId: string, cashAmount: number, cardAmount: number) {
    const response = await fetch('/api/payments/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, cashAmount, cardAmount, comment: 'Передоплата по бронюванню' }),
    })

    const data: PaymentResponse = await response.json()

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Не вдалося зберегти оплату')
    }
  }

  async function updateBooking(
    bookingId: string,
    payload: {
      bookingStatus?: 'new' | 'confirmed' | 'canceled' | 'completed'
      markReminder?: boolean
    }
  ) {
    const response = await fetch('/api/bookings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, ...payload }),
    })

    const data: UpdateResponse = await response.json()

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Не вдалося оновити бронювання')
    }
  }

  async function runItemAction(bookingId: string, actionKey: string, successMessage: string, callback: () => Promise<void>) {
    setSavingKey(`${bookingId}:${actionKey}`)
    setError('')
    setSuccess('')

    try {
      await callback()
      setSuccess(successMessage)
      setReloadToken((value) => value + 1)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
      return false
    } finally {
      setSavingKey('')
    }
  }

  async function handleAddPayment(bookingId: string, cashAmount: number, cardAmount: number) {
    if (cashAmount <= 0 && cardAmount <= 0) {
      setError('Вкажи суму оплати готівкою або карткою.')
      return false
    }

    return runItemAction(bookingId, 'pay', 'Оплату збережено.', async () => {
      await savePayment(bookingId, cashAmount, cardAmount)
    })
  }

  async function handleMarkReminder(bookingId: string) {
    return runItemAction(bookingId, 'remind', 'Нагадування позначено.', async () => {
      await updateBooking(bookingId, { markReminder: true })
    })
  }

  async function handleCancelBooking(bookingId: string) {
    return runItemAction(bookingId, 'cancel', 'Бронювання скасовано.', async () => {
      await updateBooking(bookingId, { bookingStatus: 'canceled' })
    })
  }

  const groups = useMemo(() => groupPaymentItems(items), [items])
  const expiredGroups = useMemo(
    () =>
      groups
        .map((group) => ({ fullGroup: group, displayGroup: createDisplayGroup(group, (item) => item.is_reserve_expired) }))
        .filter((entry): entry is { fullGroup: PaymentControlGroup; displayGroup: PaymentControlGroup } => Boolean(entry.displayGroup)),
    [groups]
  )
  const pendingPaymentGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          fullGroup: group,
          displayGroup: createDisplayGroup(
            group,
            (item) => item.payment_due_stage === 'before_check_in' && item.payment_status !== 'paid' && !item.is_reserve_expired
          ),
        }))
        .filter((entry): entry is { fullGroup: PaymentControlGroup; displayGroup: PaymentControlGroup } => Boolean(entry.displayGroup)),
    [groups]
  )
  const searchedGroups = useMemo(() => groups.map((group) => ({ fullGroup: group, displayGroup: group })), [groups])

  const hasSearch = searchValue.trim().length > 0

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-3 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:items-start">
          <section className={`${sectionClass} lg:sticky lg:top-24`}>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Контроль передоплат</h1>
            <div className="mt-2 text-sm leading-6 text-neutral-600">
              Пошук по телефону, ПІБ, номеру кімнати або коду бронювання. Тут менеджер бачить прострочені резерви, додає оплату, позначає нагадування і скасовує бронювання.
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-neutral-800">Пошук бронювання</span>
                <input
                  type="text"
                  inputMode="search"
                  placeholder="Телефон, ПІБ, номер або код бронювання"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className={fieldClass}
                />
              </label>

              <button type="button" onClick={() => setSearchValue('')} className={secondaryButtonClass}>
                Скинути пошук
              </button>
            </div>
          </section>

          <section className="space-y-3">
            {error ? <div className="rounded-3xl border border-[var(--crm-danger)] bg-[var(--crm-danger-soft)] px-4 py-3 text-sm text-[var(--crm-danger)]">{error}</div> : null}
            {success ? <div className="rounded-3xl border border-[var(--crm-vine-border)] bg-[var(--crm-vine-soft)] px-4 py-3 text-sm text-[var(--crm-vine-dark)]">{success}</div> : null}

            {hasSearch ? (
              <div className={sectionClass}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-neutral-900">Знайдені бронювання</div>
                    <div className="text-sm text-neutral-600">Показані всі активні бронювання, які збіглися з пошуком.</div>
                  </div>
                  <div className="rounded-full bg-[var(--crm-wine-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--crm-wine)]">{searchedGroups.length}</div>
                </div>

                {loading ? (
                  <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Пошук бронювань...</div>
                ) : searchedGroups.length === 0 ? (
                  <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">За пошуком нічого не знайдено.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {searchedGroups.map(({ fullGroup, displayGroup }) => (
                      <ReservationGroupCard
                        key={`${displayGroup.id}-search`}
                        group={displayGroup}
                        fullGroup={fullGroup}
                        savingKey={savingKey}
                        onAddPayment={handleAddPayment}
                        onMarkReminder={handleMarkReminder}
                        onCancelBooking={handleCancelBooking}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-[var(--crm-danger)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-[var(--crm-danger)]">Термін резерву вийшов</div>
                      <div className="text-sm text-[var(--crm-danger)]">Бронювання з передоплатою, де минули 3 дні і бронь ще не оплачена повністю.</div>
                    </div>
                    <div className="rounded-full bg-[var(--crm-danger)] px-3 py-1.5 text-sm font-semibold text-white">{expiredGroups.length}</div>
                  </div>

                  {loading ? (
                    <div className="mt-4 rounded-2xl bg-[var(--crm-danger-soft)] px-4 py-4 text-sm text-[var(--crm-danger)]">Завантаження резервів...</div>
                  ) : expiredGroups.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-[var(--crm-danger-soft)] px-4 py-4 text-sm text-[var(--crm-danger)]">Прострочених резервів зараз немає.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {expiredGroups.map(({ fullGroup, displayGroup }) => (
                        <ReservationGroupCard
                          key={`${displayGroup.id}-expired`}
                          group={displayGroup}
                          fullGroup={fullGroup}
                          savingKey={savingKey}
                          onAddPayment={handleAddPayment}
                          onMarkReminder={handleMarkReminder}
                          onCancelBooking={handleCancelBooking}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className={sectionClass}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-neutral-900">Очікують передоплату</div>
                      <div className="text-sm text-neutral-600">Активні резерви, де менеджер чекає оплату до заселення.</div>
                    </div>
                    <div className="rounded-full bg-[var(--crm-wine-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--crm-wine)]">{pendingPaymentGroups.length}</div>
                  </div>

                  {loading ? (
                    <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Завантаження бронювань...</div>
                  ) : pendingPaymentGroups.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Активних резервів до передоплати зараз немає.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {pendingPaymentGroups.map(({ fullGroup, displayGroup }) => (
                        <ReservationGroupCard
                          key={`${displayGroup.id}-pending-payment`}
                          group={displayGroup}
                          fullGroup={fullGroup}
                          savingKey={savingKey}
                          onAddPayment={handleAddPayment}
                          onMarkReminder={handleMarkReminder}
                          onCancelBooking={handleCancelBooking}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

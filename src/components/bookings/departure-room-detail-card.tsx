'use client'

import { useState } from 'react'
import type { PaymentStatus } from '@/constants/payment-status'
import { getPaymentDueStageLabel, type PaymentDueStage } from '@/lib/booking-note-meta'
import { formatDateForDisplay } from '@/lib/dates'
import { getPaymentStatusLabel } from '@/lib/payment-status'

export type DepartureRoomDetailItem = {
  id: string
  room_number: string
  building_name: string
  guest_name: string
  guest_phone: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  booking_note: string
  payment_due_stage: PaymentDueStage
  price_total: number
  payment_total_received: number
  payment_status: PaymentStatus
  occupancy_status: 'checked_in' | 'checked_out'
}

const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'
const primaryButtonClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)] disabled:opacity-60'

function formatMoney(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value)
}

function parseIntegerValue(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '')
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

export function DepartureRoomDetailCard({
  item,
  savingKey,
  onCheckout,
  onPayAndCheckout,
}: {
  item: DepartureRoomDetailItem
  savingKey: string
  onCheckout: (bookingId: string) => Promise<boolean>
  onPayAndCheckout: (item: DepartureRoomDetailItem, cashAmount: number, cardAmount: number) => Promise<boolean>
}) {
  const [cashValue, setCashValue] = useState('')
  const [cardValue, setCardValue] = useState('')
  const isBusy = savingKey.startsWith(`${item.id}:`)
  const isCheckedOut = item.occupancy_status === 'checked_out'
  const totalPaid = Number(item.payment_total_received || 0)
  const totalPrice = Number(item.price_total || 0)
  const balance = Math.max(0, totalPrice - totalPaid)
  const hasDebt = balance > 0

  async function handlePayAndCheckoutClick() {
    const ok = await onPayAndCheckout(item, parseIntegerValue(cashValue), parseIntegerValue(cardValue))

    if (ok) {
      setCashValue('')
      setCardValue('')
    }
  }

  return (
    <article className={`rounded-3xl border px-4 py-4 shadow-sm ${isCheckedOut ? 'border-[var(--crm-vine-border)] bg-[var(--crm-vine-soft)]' : hasDebt ? 'border-[var(--crm-danger)] bg-[var(--crm-danger-soft)]' : 'border-[var(--crm-wine-border)] bg-[var(--crm-panel)]'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-bold text-neutral-900">
            {`Номер ${item.room_number}${item.building_name ? ` (${item.building_name.toLowerCase()})` : ''}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isCheckedOut ? 'bg-[var(--crm-vine)] text-white' : hasDebt ? 'bg-[var(--crm-danger)] text-white' : 'bg-[var(--crm-wine)] text-white'}`}>
            {isCheckedOut ? 'Виселено' : hasDebt ? 'Є доплата' : 'Готово до виїзду'}
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentBadgeClass(item.payment_status)}`}>
            {getPaymentStatusLabel(item.payment_status)}
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
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплата</div>
          <div className="mt-1 font-semibold text-neutral-900">{getPaymentDueStageLabel(item.payment_due_stage)}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Вартість</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(totalPrice)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплачено</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(totalPaid)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Залишок</div>
          <div className={`mt-1 font-semibold ${hasDebt && !isCheckedOut ? 'text-[var(--crm-danger)]' : 'text-[var(--crm-vine-dark)]'}`}>{formatMoney(balance)}</div>
        </div>
      </div>

      {hasDebt && !isCheckedOut ? (
        <div className="mt-3 rounded-2xl border border-[var(--crm-danger)] bg-white px-3 py-3 text-sm font-semibold text-[var(--crm-danger)]">
          До оплати перед виїздом: {formatMoney(balance)}
        </div>
      ) : null}

      {item.booking_note ? <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">{item.booking_note}</div> : null}

      {!isCheckedOut && hasDebt ? (
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
      ) : null}

      <div className="mt-4 grid gap-2">
        {isCheckedOut ? (
          <div className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--crm-vine)] px-4 py-3 text-sm font-semibold text-white shadow-sm">
            Номер уже виселений
          </div>
        ) : hasDebt ? (
          <button
            type="button"
            onClick={handlePayAndCheckoutClick}
            disabled={isBusy || parseIntegerValue(cashValue) + parseIntegerValue(cardValue) <= 0}
            className={primaryButtonClass}
          >
            {isBusy ? 'Збереження...' : 'Оплата + виселити'}
          </button>
        ) : (
          <button type="button" onClick={() => void onCheckout(item.id)} disabled={isBusy} className={secondaryButtonClass}>
            {isBusy ? 'Оновлення...' : 'Виселити номер'}
          </button>
        )}
      </div>
    </article>
  )
}

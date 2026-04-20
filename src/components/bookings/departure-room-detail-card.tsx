'use client'

import { useState } from 'react'
import { getEditableBookingComment } from '@/components/bookings/booking-comment'
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
const textareaClass =
  'mt-2 min-h-24 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'
const primaryButtonClass =
  'inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)] disabled:opacity-60'
const subtleButtonClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-wine-soft)] px-4 py-3 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'

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
      return 'bg-[var(--crm-wine-soft)] text-[var(--crm-wine)]'
  }
}

export function DepartureRoomDetailCard({
  item,
  savingKey,
  commentValue,
  showCommentEditor,
  isCommentDirty,
  onCheckout,
  onPayAndCheckout,
  onCommentChange,
  onSaveComment,
}: {
  item: DepartureRoomDetailItem
  savingKey: string
  commentValue: string
  showCommentEditor: boolean
  isCommentDirty: boolean
  onCheckout: (bookingId: string) => Promise<boolean>
  onPayAndCheckout: (item: DepartureRoomDetailItem, totalAmount: number) => Promise<boolean>
  onCommentChange: (value: string) => void
  onSaveComment: () => Promise<boolean>
}) {
  const [paymentValue, setPaymentValue] = useState('')
  const isBusy = savingKey.startsWith(`${item.id}:`)
  const isCommentSaving = savingKey === `${item.id}:comment`
  const isCheckedOut = item.occupancy_status === 'checked_out'
  const totalPaid = Number(item.payment_total_received || 0)
  const totalPrice = Number(item.price_total || 0)
  const balance = Math.max(0, totalPrice - totalPaid)
  const hasDebt = balance > 0
  const visibleBookingNote = getEditableBookingComment(item.booking_note)

  async function handlePayAndCheckoutClick() {
    const ok = await onPayAndCheckout(item, parseIntegerValue(paymentValue))

    if (ok) {
      setPaymentValue('')
    }
  }

  return (
    <article
      className={`mx-auto max-w-[920px] rounded-3xl border px-4 py-4 shadow-sm ${
        isCheckedOut
          ? 'border-[var(--crm-vine-border)] bg-[var(--crm-vine-soft)]'
          : hasDebt
            ? 'border-[var(--crm-danger)] bg-[var(--crm-danger-soft)]'
            : 'border-[var(--crm-wine-border)] bg-[var(--crm-panel)]'
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <div className="text-lg font-bold text-neutral-900">
            {`Номер ${item.room_number}${item.building_name ? ` (${item.building_name.toLowerCase()})` : ''}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              isCheckedOut ? 'bg-[var(--crm-vine)] text-white' : hasDebt ? 'bg-[var(--crm-danger)] text-white' : 'bg-[var(--crm-wine)] text-white'
            }`}
          >
            {isCheckedOut ? 'Виселено' : hasDebt ? 'Є доплата' : 'Готово до виїзду'}
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getPaymentBadgeClass(item.payment_status)}`}>
            {getPaymentStatusLabel(item.payment_status)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Заїзд</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatDateForDisplay(item.check_in_date)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Виїзд</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatDateForDisplay(item.check_out_date)}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Вартість</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(totalPrice)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплата</div>
          <div className="mt-1 font-semibold text-neutral-900">{getPaymentDueStageLabel(item.payment_due_stage)}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Оплачено</div>
          <div className="mt-1 font-semibold text-neutral-900">{formatMoney(totalPaid)}</div>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Залишок</div>
          <div className={`mt-1 font-semibold ${hasDebt && !isCheckedOut ? 'text-[var(--crm-danger)]' : 'text-[var(--crm-vine-dark)]'}`}>
            {formatMoney(balance)}
          </div>
        </div>
      </div>

      {hasDebt && !isCheckedOut ? (
        <div className="mt-3 rounded-2xl border border-[var(--crm-danger)] bg-white px-3 py-3 text-sm font-semibold text-[var(--crm-danger)]">
          До оплати перед виїздом: {formatMoney(balance)}
        </div>
      ) : null}

      {showCommentEditor ? (
        <div className="mt-3 rounded-2xl bg-white px-3 py-3 shadow-sm">
          <div className="text-sm font-semibold text-neutral-900">Коментар менеджера</div>
          <textarea
            value={commentValue}
            onChange={(event) => onCommentChange(event.target.value)}
            className={textareaClass}
            rows={3}
          />
          {isCommentDirty ? (
            <button
              type="button"
              onClick={() => void onSaveComment()}
              disabled={isBusy}
              className={`${subtleButtonClass} mt-3`}
            >
              {isCommentSaving ? 'Збереження...' : 'Зберегти коментар'}
            </button>
          ) : null}
        </div>
      ) : visibleBookingNote ? (
        <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">{visibleBookingNote}</div>
      ) : null}

      {!isCheckedOut && hasDebt ? (
        <label className="mt-4 block">
          <span className="text-sm font-medium text-neutral-800">Оплата, грн</span>
          <input
            type="text"
            inputMode="numeric"
            value={paymentValue}
            onChange={(event) => setPaymentValue(sanitizeIntegerInput(event.target.value))}
            className={fieldClass}
          />
        </label>
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
            disabled={isBusy || parseIntegerValue(paymentValue) <= 0}
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

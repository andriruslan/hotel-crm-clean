'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getEditableBookingComment, normalizeBookingCommentInput } from '@/components/bookings/booking-comment'
import { getVisibleGuestName } from '@/components/bookings/arrival-shared'
import { DepartureRoomDetailCard, type DepartureRoomDetailItem } from '@/components/bookings/departure-room-detail-card'
import type { PaymentDueStage } from '@/lib/booking-note-meta'
import { dateInputToIso, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
import { normalizePhone } from '@/lib/phone'

type DeparturesResponse = {
  ok: boolean
  items?: DepartureRoomDetailItem[]
  error?: string
}

type UpdateResponse = {
  ok: boolean
  error?: string
  bookingNote?: string
}

type PaymentResponse = {
  ok: boolean
  error?: string
}

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5'
const inlineButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-4 text-sm font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'

export function DepartureRoomPage({
  bookingId,
  initialDate,
}: {
  bookingId: string
  initialDate: string
}) {
  const router = useRouter()
  const today = isoDateToInputValue(getTodayDate())
  const safeInitialDate = isCompleteDateInput(initialDate) ? initialDate : today

  const [item, setItem] = useState<DepartureRoomDetailItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savingKey, setSavingKey] = useState('')
  const [commentValue, setCommentValue] = useState('')
  const [savedCommentValue, setSavedCommentValue] = useState('')

  useEffect(() => {
    if (!isCompleteDateInput(safeInitialDate)) {
      setItem(null)
      return
    }

    let isCancelled = false

    async function loadDeparture() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/bookings/departures-today?date=${encodeURIComponent(dateInputToIso(safeInitialDate))}`)
        const data: DeparturesResponse = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Не вдалося отримати дані по номеру')
        }

        if (isCancelled) {
          return
        }

        const foundItem = (data.items || []).find((entry) => entry.id === bookingId) || null
        setItem(foundItem)

        if (!foundItem) {
          setError('На вибрану дату цей номер не знайдено у списку виїздів.')
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

    void loadDeparture()

    return () => {
      isCancelled = true
    }
  }, [bookingId, safeInitialDate])

  useEffect(() => {
    const nextComment = getEditableBookingComment(item?.booking_note)
    setCommentValue(nextComment)
    setSavedCommentValue(nextComment)
  }, [item?.id, item?.booking_note])

  const normalizedCommentValue = normalizeBookingCommentInput(commentValue)
  const normalizedSavedCommentValue = normalizeBookingCommentInput(savedCommentValue)
  const isCommentDirty = normalizedCommentValue !== normalizedSavedCommentValue
  const showCommentEditor = Boolean(normalizedCommentValue || normalizedSavedCommentValue)

  async function saveBookingComment(nextBookingId: string, nextComment: string) {
    const response = await fetch('/api/bookings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: nextBookingId, bookingNote: nextComment }),
    })

    const data: UpdateResponse = await response.json()

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Не вдалося зберегти коментар')
    }

    return data
  }

  async function persistCommentIfNeeded(nextBookingId: string) {
    if (!isCommentDirty) {
      return true
    }

    const data = await saveBookingComment(nextBookingId, normalizedCommentValue)
    const nextVisibleComment = getEditableBookingComment(data.bookingNote ?? normalizedCommentValue)

    setSavedCommentValue(nextVisibleComment)
    setCommentValue(nextVisibleComment)
    setItem((currentItem) =>
      currentItem && currentItem.id === nextBookingId
        ? {
            ...currentItem,
            booking_note: data.bookingNote ?? nextVisibleComment,
          }
        : currentItem
    )

    return true
  }

  async function updateBookingStatus(nextBookingId: string) {
    const response = await fetch('/api/bookings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: nextBookingId, occupancyStatus: 'checked_out' }),
    })

    const data: UpdateResponse = await response.json()

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Не вдалося оновити статус виселення')
    }
  }

  async function savePayment(
    nextBookingId: string,
    totalAmount: number,
    comment: string,
    paymentDueStage?: PaymentDueStage
  ) {
    const response = await fetch('/api/payments/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: nextBookingId, cashAmount: totalAmount, cardAmount: 0, comment, paymentDueStage }),
    })

    const data: PaymentResponse = await response.json()

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Не вдалося зберегти оплату')
    }
  }

  async function runItemAction(nextBookingId: string, actionKey: string, callback: () => Promise<void>) {
    setSavingKey(`${nextBookingId}:${actionKey}`)
    setError('')

    try {
      await persistCommentIfNeeded(nextBookingId)
      await callback()
      router.push(`/bookings/departures?date=${encodeURIComponent(dateInputToIso(safeInitialDate))}`)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
      return false
    } finally {
      setSavingKey('')
    }
  }

  async function handleSaveComment() {
    if (!item) {
      return false
    }

    setSavingKey(`${item.id}:comment`)
    setError('')

    try {
      await persistCommentIfNeeded(item.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
      return false
    } finally {
      setSavingKey('')
    }
  }

  async function handleCheckout(nextBookingId: string) {
    return runItemAction(nextBookingId, 'checkout', async () => {
      await updateBookingStatus(nextBookingId)
    })
  }

  async function handlePayAndCheckout(nextItem: DepartureRoomDetailItem, totalAmount: number) {
    if (totalAmount <= 0) {
      setError('Вкажи суму оплати.')
      return false
    }

    return runItemAction(nextItem.id, 'pay-checkout', async () => {
      await savePayment(nextItem.id, totalAmount, 'Оплата при виїзді', 'at_check_out')
      await updateBookingStatus(nextItem.id)
    })
  }

  const visibleGuestName = getVisibleGuestName(item?.guest_name)

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-[1080px] space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <section className={`${sectionClass} w-full lg:max-w-[360px]`}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Картка виїзду</h1>
              {item?.occupancy_status === 'checked_out' ? (
                <span className="rounded-full bg-[var(--crm-vine)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                  Виселено
                </span>
              ) : null}
            </div>

            {item ? (
              <div className="mt-3 space-y-1 text-sm text-neutral-700">
                <div className="text-base font-semibold text-neutral-900">{normalizePhone(item.guest_phone || '') || 'Телефон не вказано'}</div>
                {visibleGuestName ? <div className="break-words">{visibleGuestName}</div> : null}
              </div>
            ) : null}
          </section>

          <div className="flex w-full justify-start lg:w-auto lg:justify-end lg:pt-4">
            <Link
              href={`/bookings/departures?date=${encodeURIComponent(dateInputToIso(safeInitialDate))}`}
              className={`${inlineButtonClass} w-full sm:w-auto`}
            >
              Повернутися до виїздів
            </Link>
          </div>
        </div>

        {error ? <div className="rounded-3xl border border-[var(--crm-danger)] bg-[var(--crm-danger-soft)] px-4 py-3 text-sm text-[var(--crm-danger)]">{error}</div> : null}

        {loading ? (
          <section className={sectionClass}>
            <div className="text-sm text-neutral-600">Завантаження картки виїзду...</div>
          </section>
        ) : item ? (
          <DepartureRoomDetailCard
            item={item}
            savingKey={savingKey}
            commentValue={commentValue}
            showCommentEditor={showCommentEditor}
            isCommentDirty={isCommentDirty}
            onCheckout={handleCheckout}
            onPayAndCheckout={handlePayAndCheckout}
            onCommentChange={setCommentValue}
            onSaveComment={handleSaveComment}
          />
        ) : (
          <section className={sectionClass}>
            <div className="text-sm text-neutral-600">На вибрану дату картка виїзду не знайдена.</div>
            <div className="mt-4">
              <Link
                href={`/bookings/departures?date=${encodeURIComponent(dateInputToIso(safeInitialDate))}`}
                className={inlineButtonClass}
              >
                Повернутися до виїздів
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { addOneDay, getTodayDate } from '@/lib/dates'
import { calculateBookingPrice } from '@/lib/pricing'
import { isNonEmpty, isValidPhone } from '@/lib/validators'
import type { AvailabilityItem } from '@/types/availability'

type GuestSearchResponse = {
  ok: boolean
  guest?: {
    id: string
    full_name: string
    phone: string
    birth_date: string
    guest_note: string
  } | null
  error?: string
}

type AvailabilityResponse = {
  ok: boolean
  items?: AvailabilityItem[]
  error?: string
}

type CreateBookingResponse = {
  ok: boolean
  bookingId?: string
  guestId?: string
  error?: string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function NewBookingPage() {
  const today = useMemo(() => getTodayDate(), [])
  const tomorrow = useMemo(() => addOneDay(today), [today])

  const [phone, setPhone] = useState('')
  const [guestId, setGuestId] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guestNote, setGuestNote] = useState('')

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [guestsCount, setGuestsCount] = useState(2)

  const [bookingNote, setBookingNote] = useState('')
  const [status, setStatus] = useState<'new' | 'confirmed'>('new')
  const [paymentCash, setPaymentCash] = useState(0)
  const [paymentCard, setPaymentCard] = useState(0)

  const [availableRooms, setAvailableRooms] = useState<AvailabilityItem[]>([])
  const [selectedRoom, setSelectedRoom] = useState<AvailabilityItem | null>(null)

  const [searchingGuest, setSearchingGuest] = useState(false)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [saving, setSaving] = useState(false)

  const [guestMessage, setGuestMessage] = useState('')
  const [roomsMessage, setRoomsMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setSelectedRoom(null)
  }, [checkIn, checkOut, guestsCount])

  const pricing = useMemo(() => {
    if (!selectedRoom) {
      return {
        nights: 0,
        extraBedsCount: 0,
        priceBaseTotal: 0,
        priceExtraTotal: 0,
        priceTotal: 0,
      }
    }

    return calculateBookingPrice({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestsCount,
      baseCapacity: selectedRoom.base_capacity,
      basePricePerNight: selectedRoom.base_price_per_night,
      extraBedPricePerNight: selectedRoom.extra_bed_price_per_night,
    })
  }, [selectedRoom, checkIn, checkOut, guestsCount])

  const totalPaid = Number(paymentCash || 0) + Number(paymentCard || 0)
  const paymentStatus =
    totalPaid <= 0 ? 'unpaid' : totalPaid < pricing.priceTotal ? 'partial' : 'paid'
  const balance = Math.max(0, pricing.priceTotal - totalPaid)

  async function handleFindGuest() {
    setGuestMessage('')
    setError('')
    setSuccess('')

    if (!isValidPhone(phone)) {
      setGuestMessage('Введи коректний номер телефону.')
      return
    }

    setSearchingGuest(true)

    try {
      const response = await fetch(`/api/guests/search?phone=${encodeURIComponent(phone)}`)
      const data: GuestSearchResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося виконати пошук гостя')
      }

      if (data.guest) {
        setGuestId(data.guest.id)
        setFullName(data.guest.full_name)
        setBirthDate(data.guest.birth_date)
        setGuestNote(data.guest.guest_note || '')
        setGuestMessage('Гість знайдений. Дані підставлено автоматично.')
      } else {
        setGuestId('')
        setFullName('')
        setBirthDate('')
        setGuestNote('')
        setGuestMessage('Гостя не знайдено. Заповни дані для нового гостя.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setSearchingGuest(false)
    }
  }

  async function handleFindRooms() {
    setRoomsMessage('')
    setError('')
    setSuccess('')
    setAvailableRooms([])
    setSelectedRoom(null)

    if (checkOut <= checkIn) {
      setRoomsMessage('Дата виїзду має бути пізніше за дату заїзду.')
      return
    }

    if (guestsCount < 1) {
      setRoomsMessage('Кількість гостей має бути більшою за 0.')
      return
    }

    setLoadingRooms(true)

    try {
      const params = new URLSearchParams({
        checkIn,
        checkOut,
        guestsCount: String(guestsCount),
      })

      const response = await fetch(`/api/availability?${params.toString()}`)
      const data: AvailabilityResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося отримати список номерів')
      }

      setAvailableRooms(data.items || [])
      setRoomsMessage(
        (data.items || []).length > 0
          ? 'Вільні номери знайдено. Обери потрібний номер.'
          : 'На вибрані дати вільних номерів не знайдено.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setLoadingRooms(false)
    }
  }

  async function handleCreateBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!isValidPhone(phone)) {
      setError('Телефон обов’язковий і має бути коректним.')
      return
    }

    if (!isNonEmpty(fullName)) {
      setError('ПІБ є обов’язковим.')
      return
    }

    if (!birthDate) {
      setError('Дата народження є обов’язковою.')
      return
    }

    if (!selectedRoom) {
      setError('Спочатку знайди і обери номер.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: {
            id: guestId || null,
            phone,
            full_name: fullName,
            birth_date: birthDate,
            guest_note: guestNote,
          },
          booking: {
            room_id: selectedRoom.room_id,
            check_in_date: checkIn,
            check_out_date: checkOut,
            guests_count: guestsCount,
            extra_beds_count: pricing.extraBedsCount,
            booking_note: bookingNote,
            status,
            payment_cash_amount: Number(paymentCash || 0),
            payment_card_amount: Number(paymentCard || 0),
            price_base_total: pricing.priceBaseTotal,
            price_extra_total: pricing.priceExtraTotal,
            price_total: pricing.priceTotal,
          },
        }),
      })

      const data: CreateBookingResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося створити бронювання')
      }

      setSuccess(`Бронювання створено успішно. ID: ${data.bookingId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setSaving(false)
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

        <form onSubmit={handleCreateBooking} className="space-y-3">
          <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Нове бронювання</h1>
            <p className="mt-1 text-sm leading-5 text-neutral-600">Створення нового бронювання для гостя.</p>
          </section>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

          <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-base font-semibold">1. Пошук або створення гостя</div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Телефон *</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
              </label>

              <button type="button" onClick={handleFindGuest} disabled={searchingGuest} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-60">
                {searchingGuest ? 'Пошук гостя...' : 'Знайти гостя'}
              </button>

              {guestMessage ? <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{guestMessage}</div> : null}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ПІБ *</span>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Дата народження *</span>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Коментар по гостю</span>
                <textarea value={guestNote} onChange={(e) => setGuestNote(e.target.value)} rows={3} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-[16px] outline-none focus:border-neutral-500" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-base font-semibold">2. Дати і підбір номера</div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Дата заїзду</span>
                <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Дата виїзду</span>
                <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Кількість гостей</span>
                <input type="number" min={1} max={20} value={guestsCount} onChange={(e) => setGuestsCount(Number(e.target.value))} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" required />
              </label>

              <button type="button" onClick={handleFindRooms} disabled={loadingRooms} className="h-11 w-full rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
                {loadingRooms ? 'Пошук номерів...' : 'Знайти вільні номери'}
              </button>

              {roomsMessage ? <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{roomsMessage}</div> : null}

              {availableRooms.length > 0 ? (
                <div className="space-y-2">
                  {availableRooms.map((room) => {
                    const isSelected = selectedRoom?.room_id === room.room_id

                    return (
                      <button
                        key={room.room_id}
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                          isSelected
                            ? 'border-black bg-black text-white'
                            : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-bold">Номер {room.room_number}</div>
                            <div className={`mt-1 text-xs ${isSelected ? 'text-neutral-200' : 'text-neutral-500'}`}>
                              {room.building_name} · {room.room_type_name}
                            </div>
                          </div>
                          <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                            {formatMoney(room.price_total)}
                          </div>
                        </div>

                        <div className={`mt-2 text-xs ${isSelected ? 'text-neutral-200' : 'text-neutral-600'}`}>
                          {room.guests_count} гост. · {room.nights} ноч. · доп. місць: {room.extra_beds_count}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-base font-semibold">3. Бронювання і оплата</div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Коментар по бронюванню</span>
                <textarea value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} rows={3} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-[16px] outline-none focus:border-neutral-500" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Статус бронювання</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'new' | 'confirmed')} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500">
                  <option value="new">new</option>
                  <option value="confirmed">confirmed</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Оплата готівкою, грн</span>
                <input type="number" min={0} value={paymentCash} onChange={(e) => setPaymentCash(Number(e.target.value))} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Оплата карткою, грн</span>
                <input type="number" min={0} value={paymentCard} onChange={(e) => setPaymentCard(Number(e.target.value))} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] outline-none focus:border-neutral-500" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-base font-semibold">4. Підсумок</div>

            <div className="mt-3 space-y-2 text-sm text-neutral-700">
              <div className="flex items-center justify-between gap-3"><span>Обраний номер</span><span className="font-medium">{selectedRoom ? `${selectedRoom.building_name} · ${selectedRoom.room_number}` : '—'}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Ночей</span><span className="font-medium">{pricing.nights}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Доп. місць</span><span className="font-medium">{pricing.extraBedsCount}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Базова сума</span><span className="font-medium">{formatMoney(pricing.priceBaseTotal)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Доп. місця</span><span className="font-medium">{formatMoney(pricing.priceExtraTotal)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Оплачено</span><span className="font-medium">{formatMoney(totalPaid)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Статус оплати</span><span className="font-medium">{paymentStatus}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Залишок</span><span className="font-medium">{formatMoney(balance)}</span></div>
            </div>

            <div className="mt-4 rounded-2xl bg-neutral-100 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Загальна вартість</div>
              <div className="mt-1 text-2xl font-bold">{formatMoney(pricing.priceTotal)}</div>
            </div>

            <button type="submit" disabled={saving} className="mt-4 h-11 w-full rounded-xl bg-black px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
              {saving ? 'Створення бронювання...' : 'Створити бронювання'}
            </button>
          </section>
        </form>
      </div>
    </main>
  )
}

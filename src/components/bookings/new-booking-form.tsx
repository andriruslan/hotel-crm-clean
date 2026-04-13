'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { getDefaultPaymentDueStage, getPaymentDueStageLabel, type PaymentDueStage } from '@/lib/booking-note-meta'
import { addOneDay, dateInputToIso, formatDateForDisplay, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
import {
  buildGuestCompositionSummary,
  getPaidExtraBedsCount,
  getTotalGuestsCount,
  type GuestComposition,
} from '@/lib/guest-composition'
import { getPaymentStatus, getPaymentStatusLabel } from '@/lib/payment-status'
import { formatPhoneInput, normalizePhone } from '@/lib/phone'
import { calculateBookingPrice } from '@/lib/pricing'
import { isValidPhone } from '@/lib/validators'
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
  bookingIds?: string[]
  bookingGroupId?: string
  error?: string
}

type DraftRoom = {
  key: string
  room: AvailabilityItem
  checkIn: string
  checkOut: string
  adultsCount: number
  childrenUnder6Count: number
  children6PlusCount: number
  guestsCount: number
  paidExtraBedsCount: number
  freeExtraBedsCount: number
  bookingNote: string
  priceBaseTotal: string
  priceExtraTotal: string
  paymentCash: string
  paymentCard: string
}

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-4 py-4 shadow-sm sm:px-5 sm:py-5'
const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const textAreaClass =
  'mt-1.5 min-h-28 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const primaryButtonClass =
  'h-12 w-full rounded-2xl bg-[var(--crm-wine)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)] disabled:opacity-60'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-4 text-sm font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'
const counterButtonClass =
  'flex h-12 items-center justify-center rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] text-xl font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)]'
const counterPrimaryButtonClass =
  'flex h-12 items-center justify-center rounded-2xl bg-[var(--crm-wine)] text-xl font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)]'

function formatMoney(value: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(value)
}

function parsePositiveNumber(value: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseIntegerValue(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '')
}

function getSearchComposition(adultsCount: number, childrenUnder6Count: number, children6PlusCount: number): GuestComposition {
  return {
    adultsCount: Math.max(0, adultsCount),
    childrenUnder6Count: Math.max(0, childrenUnder6Count),
    children6PlusCount: Math.max(0, children6PlusCount),
  }
}

function getDefaultCompositionFromGuestsCount(guestsCount: number): GuestComposition {
  return {
    adultsCount: Math.max(1, guestsCount),
    childrenUnder6Count: 0,
    children6PlusCount: 0,
  }
}

function getExtraBedSummaryLabel(paidExtraBedsCount: number, freeExtraBedsCount: number) {
  if (paidExtraBedsCount === 0 && freeExtraBedsCount === 0) {
    return 'Без додаткових місць'
  }

  const parts: string[] = []

  if (paidExtraBedsCount > 0) {
    parts.push(`платних: ${paidExtraBedsCount}`)
  }

  if (freeExtraBedsCount > 0) {
    parts.push(`безкоштовних: ${freeExtraBedsCount}`)
  }

  return `Додаткові місця: ${parts.join(', ')}`
}

function createDraftRoom(
  room: AvailabilityItem,
  checkIn: string,
  checkOut: string,
  composition: GuestComposition
): DraftRoom {
  const guestsCount = getTotalGuestsCount(composition)
  const paidExtraBedsCount = getPaidExtraBedsCount(composition, room.base_capacity)
  const checkInIso = dateInputToIso(checkIn)
  const checkOutIso = dateInputToIso(checkOut)
  const pricing = calculateBookingPrice({
    checkInDate: checkInIso,
    checkOutDate: checkOutIso,
    guestsCount,
    baseCapacity: room.base_capacity,
    basePricePerNight: room.base_price_per_night,
    extraBedPricePerNight: room.extra_bed_price_per_night,
    paidExtraBedsCount,
  })

  return {
    key: `${room.room_id}-${checkIn}-${checkOut}-${guestsCount}-${Date.now()}`,
    room,
    checkIn,
    checkOut,
    adultsCount: composition.adultsCount,
    childrenUnder6Count: composition.childrenUnder6Count,
    children6PlusCount: composition.children6PlusCount,
    guestsCount,
    paidExtraBedsCount: pricing.paidExtraBedsCount,
    freeExtraBedsCount: pricing.freeExtraBedsCount,
    bookingNote: '',
    priceBaseTotal: String(pricing.priceBaseTotal),
    priceExtraTotal: String(pricing.priceExtraTotal),
    paymentCash: '',
    paymentCard: '',
  }
}

function recalculateDraftRoom(
  room: DraftRoom,
  patch: Partial<Pick<DraftRoom, 'adultsCount' | 'childrenUnder6Count' | 'children6PlusCount'>>
): DraftRoom {
  const composition = getSearchComposition(
    patch.adultsCount ?? room.adultsCount,
    patch.childrenUnder6Count ?? room.childrenUnder6Count,
    patch.children6PlusCount ?? room.children6PlusCount
  )
  const guestsCount = getTotalGuestsCount(composition)
  const paidExtraBedsCount = getPaidExtraBedsCount(composition, room.room.base_capacity)
  const checkInIso = dateInputToIso(room.checkIn)
  const checkOutIso = dateInputToIso(room.checkOut)
  const pricing = calculateBookingPrice({
    checkInDate: checkInIso,
    checkOutDate: checkOutIso,
    guestsCount,
    baseCapacity: room.room.base_capacity,
    basePricePerNight: room.room.base_price_per_night,
    extraBedPricePerNight: room.room.extra_bed_price_per_night,
    paidExtraBedsCount,
  })

  return {
    ...room,
    adultsCount: composition.adultsCount,
    childrenUnder6Count: composition.childrenUnder6Count,
    children6PlusCount: composition.children6PlusCount,
    guestsCount,
    paidExtraBedsCount: pricing.paidExtraBedsCount,
    freeExtraBedsCount: pricing.freeExtraBedsCount,
    priceExtraTotal: String(pricing.priceExtraTotal),
  }
}

function buildBookingNoteWithGuestSummary(note: string, room: DraftRoom) {
  const visibleNote = note.trim()
  const summary = `Склад гостей: ${buildGuestCompositionSummary({
    adultsCount: room.adultsCount,
    childrenUnder6Count: room.childrenUnder6Count,
    children6PlusCount: room.children6PlusCount,
  })}`
  const extraInfo = `Додаткові місця: платних ${room.paidExtraBedsCount}, безкоштовних ${room.freeExtraBedsCount}`

  return [visibleNote, summary, extraInfo].filter(Boolean).join('\n')
}

function readRoomFromQuery() {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const roomId = params.get('roomId')
  const roomNumber = params.get('roomNumber')
  const buildingName = params.get('buildingName')
  const roomTypeName = params.get('roomTypeName')
  const checkIn = params.get('checkIn')
  const checkOut = params.get('checkOut')
  const guestsCount = parsePositiveNumber(params.get('guestsCount'))
  const adultsCount = parsePositiveNumber(params.get('adultsCount'))
  const childrenUnder6Count = parsePositiveNumber(params.get('childrenUnder6Count'))
  const children6PlusCount = parsePositiveNumber(params.get('children6PlusCount'))
  const baseCapacity = parsePositiveNumber(params.get('baseCapacity'))
  const maxCapacity = parsePositiveNumber(params.get('maxCapacity'))
  const basePricePerNight = parsePositiveNumber(params.get('basePricePerNight'))
  const extraBedPricePerNight = parsePositiveNumber(params.get('extraBedPricePerNight'))

  if (
    !roomId ||
    !roomNumber ||
    !buildingName ||
    !roomTypeName ||
    !checkIn ||
    !checkOut ||
    !guestsCount ||
    !baseCapacity ||
    !maxCapacity ||
    basePricePerNight === null ||
    extraBedPricePerNight === null
  ) {
    return null
  }

  const composition =
    adultsCount !== null && childrenUnder6Count !== null && children6PlusCount !== null
      ? getSearchComposition(adultsCount, childrenUnder6Count, children6PlusCount)
      : getDefaultCompositionFromGuestsCount(guestsCount)
  const paidExtraBedsCount = getPaidExtraBedsCount(composition, baseCapacity)

  const pricing = calculateBookingPrice({
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guestsCount,
    baseCapacity,
    basePricePerNight,
    extraBedPricePerNight,
    paidExtraBedsCount,
  })

  return createDraftRoom(
    {
      room_id: roomId,
      room_number: roomNumber,
      building_name: buildingName,
      room_type_name: roomTypeName,
      base_capacity: baseCapacity,
      max_capacity: maxCapacity,
      base_price_per_night: basePricePerNight,
      extra_bed_price_per_night: extraBedPricePerNight,
      guests_count: guestsCount,
      nights: pricing.nights,
      extra_beds_count: pricing.extraBedsCount,
      free_extra_beds_count: pricing.freeExtraBedsCount,
      price_base_total: pricing.priceBaseTotal,
      price_extra_total: pricing.priceExtraTotal,
      price_total: pricing.priceTotal,
    },
    isoDateToInputValue(checkIn),
    isoDateToInputValue(checkOut),
    composition
  )
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
      <span className="text-sm font-medium">{label}</span>
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

export function NewBookingForm() {
  const router = useRouter()
  const today = useMemo(() => isoDateToInputValue(getTodayDate()), [])
  const tomorrow = useMemo(() => isoDateToInputValue(addOneDay(getTodayDate())), [])

  const [phone, setPhone] = useState(formatPhoneInput(''))
  const [guestId, setGuestId] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guestNote, setGuestNote] = useState('')
  const [status, setStatus] = useState<'new' | 'confirmed'>('new')
  const [paymentDueStage, setPaymentDueStage] = useState<PaymentDueStage>(getDefaultPaymentDueStage())

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [adultsCount, setAdultsCount] = useState(2)
  const [childrenUnder6Count, setChildrenUnder6Count] = useState(0)
  const [children6PlusCount, setChildren6PlusCount] = useState(0)
  const [availableRooms, setAvailableRooms] = useState<AvailabilityItem[]>([])
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([])
  const [isAddRoomSectionOpen, setIsAddRoomSectionOpen] = useState(true)

  const [searchingGuest, setSearchingGuest] = useState(false)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [guestMessage, setGuestMessage] = useState('')
  const [roomsMessage, setRoomsMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [bookingCreatedMessage, setBookingCreatedMessage] = useState('')
  const searchComposition = useMemo(
    () => getSearchComposition(adultsCount, childrenUnder6Count, children6PlusCount),
    [adultsCount, childrenUnder6Count, children6PlusCount]
  )
  const guestsCount = getTotalGuestsCount(searchComposition)
  const paidSearchExtraBedsCount = useMemo(() => getPaidExtraBedsCount(searchComposition, 2), [searchComposition])

  function resetForm() {
    setPhone(formatPhoneInput(''))
    setGuestId('')
    setFullName('')
    setBirthDate('')
    setGuestNote('')
    setStatus('new')
    setPaymentDueStage(getDefaultPaymentDueStage())
    setCheckIn(today)
    setCheckOut(tomorrow)
    setAdultsCount(2)
    setChildrenUnder6Count(0)
    setChildren6PlusCount(0)
    setAvailableRooms([])
    setDraftRooms([])
    setIsAddRoomSectionOpen(true)
    setGuestMessage('')
    setRoomsMessage('')
    setError('')
  }

  useEffect(() => {
    const draftRoom = readRoomFromQuery()

    if (draftRoom) {
      setCheckIn(draftRoom.checkIn)
      setCheckOut(draftRoom.checkOut)
      setAdultsCount(draftRoom.adultsCount)
      setChildrenUnder6Count(draftRoom.childrenUnder6Count)
      setChildren6PlusCount(draftRoom.children6PlusCount)
      setDraftRooms([draftRoom])
      setIsAddRoomSectionOpen(false)
      setRoomsMessage('Номер додано з екрана доступності.')
    }
  }, [])

  const totalPrice = draftRooms.reduce(
    (sum, room) => sum + parseIntegerValue(room.priceBaseTotal) + parseIntegerValue(room.priceExtraTotal),
    0
  )
  const totalPaid = draftRooms.reduce(
    (sum, room) => sum + parseIntegerValue(room.paymentCash) + parseIntegerValue(room.paymentCard),
    0
  )
  const paymentStatus = getPaymentStatus(totalPrice, totalPaid)
  const balance = Math.max(0, totalPrice - totalPaid)

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
        setPhone(formatPhoneInput(data.guest.phone))
        setFullName(data.guest.full_name)
        setBirthDate(formatDateForDisplay(data.guest.birth_date))
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

    if (!isCompleteDateInput(checkIn) || !isCompleteDateInput(checkOut)) {
      setRoomsMessage('Дати мають бути у форматі ДД-ММ-РРРР.')
      return
    }

    const checkInIso = dateInputToIso(checkIn)
    const checkOutIso = dateInputToIso(checkOut)

    if (!checkInIso || !checkOutIso) {
      setRoomsMessage('Дати мають бути у форматі ДД-ММ-РРРР.')
      return
    }

    if (checkOutIso <= checkInIso) {
      setRoomsMessage('Дата виїзду має бути пізніше за дату заїзду.')
      return
    }

    if (guestsCount < 1) {
      setRoomsMessage('Вкажи коректну кількість гостей.')
      return
    }

    setLoadingRooms(true)

    try {
      const params = new URLSearchParams({
        checkIn: checkInIso,
        checkOut: checkOutIso,
        guestsCount: String(guestsCount),
        adultsCount: String(adultsCount),
        childrenUnder6Count: String(childrenUnder6Count),
        children6PlusCount: String(children6PlusCount),
      })
      const response = await fetch(`/api/availability?${params.toString()}`)
      const data: AvailabilityResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося отримати список номерів')
      }

      setAvailableRooms(data.items || [])
      setRoomsMessage((data.items || []).length > 0 ? 'Вільні номери знайдено. Додай потрібні в бронювання.' : 'На вибрані дати вільних номерів не знайдено.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setLoadingRooms(false)
    }
  }

  function addDraftRoom(room: AvailabilityItem) {

    if (guestsCount < 1) {
      setRoomsMessage('Вкажи коректну кількість гостей.')
      return
    }

    setDraftRooms((current) => [...current, createDraftRoom(room, checkIn, checkOut, searchComposition)])
    setSuccess('Номер додано в бронювання.')
  }

  function updateDraftRoom(key: string, patch: Partial<DraftRoom>) {
    setDraftRooms((current) => current.map((room) => (room.key === key ? { ...room, ...patch } : room)))
  }

  function updateDraftRoomComposition(
    key: string,
    patch: Partial<Pick<DraftRoom, 'adultsCount' | 'childrenUnder6Count' | 'children6PlusCount'>>
  ) {
    let nextError = ''

    setDraftRooms((current) =>
      current.map((room) => {
        if (room.key !== key) {
          return room
        }

        const nextRoom = recalculateDraftRoom(room, patch)

        if (nextRoom.guestsCount < 1) {
          nextError = 'У номері має бути хоча б один гість.'
          return room
        }

        if (nextRoom.guestsCount > room.room.max_capacity) {
          nextError = `У номері ${room.room.room_number} максимум ${room.room.max_capacity} гостя(ів).`
          return room
        }

        return nextRoom
      })
    )

    if (nextError) {
      setError(nextError)
      return
    }

    setError('')
  }

  async function handleCreateBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!isValidPhone(phone)) {
      setError('Телефон обов’язковий і має бути коректним.')
      return
    }

    if (birthDate && !isCompleteDateInput(birthDate)) {
      setError('Дата народження має бути у форматі ДД-ММ-РРРР.')
      return
    }

    if (draftRooms.length === 0) {
      setError('Додай хоча б один номер у бронювання.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/bookings/create-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: {
            id: guestId || null,
            phone: normalizePhone(phone),
            full_name: fullName,
            birth_date: birthDate ? dateInputToIso(birthDate) : '',
            guest_note: guestNote,
          },
          bookings: draftRooms.map((room) => ({
            room_id: room.room.room_id,
            check_in_date: dateInputToIso(room.checkIn),
            check_out_date: dateInputToIso(room.checkOut),
            guests_count: room.guestsCount,
            extra_beds_count: room.paidExtraBedsCount,
            booking_note: buildBookingNoteWithGuestSummary(room.bookingNote, room),
            payment_due_stage: paymentDueStage,
            status,
            payment_cash_amount: parseIntegerValue(room.paymentCash),
            payment_card_amount: parseIntegerValue(room.paymentCard),
            price_base_total: parseIntegerValue(room.priceBaseTotal),
            price_extra_total: parseIntegerValue(room.priceExtraTotal),
            price_total: parseIntegerValue(room.priceBaseTotal) + parseIntegerValue(room.priceExtraTotal),
          })),
        }),
      })

      const data: CreateBookingResponse = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Не вдалося створити бронювання')
      }

      const successMessage =
        draftRooms.length > 1
          ? `Успішно: створено одне замовлення на ${draftRooms.length} номерів.`
          : 'Успішно: бронювання створено.'

      resetForm()
      setBookingCreatedMessage(successMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setSaving(false)
    }
  }

  function handleCloseBookingCreatedMessage() {
    setBookingCreatedMessage('')

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push('/')
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <section className={sectionClass}>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Нове бронювання</h1>
        </section>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] xl:items-start">
          <form id="booking-form" onSubmit={handleCreateBooking} className="space-y-3">
            {error ? <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-3xl border border-[var(--crm-vine-border)] bg-[var(--crm-vine-soft)] px-4 py-3 text-sm text-[var(--crm-vine-dark)]">{success}</div> : null}

            <section className={sectionClass}>
              <div className="text-base font-semibold sm:text-lg">1. Гість</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Телефон *</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    placeholder="+38 123 456-78-90"
                    className={fieldClass}
                    required
                  />
                </label>
                <div className="md:pt-[1.9rem]">
                  <button type="button" onClick={handleFindGuest} disabled={searchingGuest} className={secondaryButtonClass}>
                    {searchingGuest ? 'Пошук...' : 'Знайти'}
                  </button>
                </div>
                {guestMessage ? <div className="rounded-2xl bg-neutral-100 px-3 py-3 text-sm text-neutral-700 md:col-span-2">{guestMessage}</div> : null}
                <label className="block">
                  <span className="text-sm font-medium">ПІБ</span>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldClass} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Дата народження</span>
                  <DatePickerField value={birthDate} onChange={setBirthDate} className={fieldClass} />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium">Коментар по гостю</span>
                  <textarea value={guestNote} onChange={(e) => setGuestNote(e.target.value)} rows={4} className={textAreaClass} />
                </label>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold sm:text-lg">2. Додати номер</div>
                <button
                  type="button"
                  onClick={() => setIsAddRoomSectionOpen((current) => !current)}
                  className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-4 py-2 text-sm font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)]"
                >
                  {isAddRoomSectionOpen ? 'Згорнути' : draftRooms.length > 0 ? 'Додати ще номер' : 'Відкрити'}
                </button>
              </div>

              {isAddRoomSectionOpen ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="block">
                      <span className="text-sm font-medium">Дата заїзду</span>
                      <DatePickerField value={checkIn} onChange={setCheckIn} className={fieldClass} />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Дата виїзду</span>
                      <DatePickerField value={checkOut} onChange={setCheckOut} className={fieldClass} />
                    </label>
                    <div className="rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-4 md:col-span-2 xl:col-span-3">
                      <div className="text-sm font-semibold text-[var(--crm-wine)]">Склад гостей для пошуку номера</div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        <CompositionField label="Гості" value={adultsCount} onChange={setAdultsCount} />
                        <CompositionField label="Додаткові гості" value={children6PlusCount} onChange={setChildren6PlusCount} />
                        <CompositionField label="До 6 років" value={childrenUnder6Count} onChange={setChildrenUnder6Count} />
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-neutral-500">Всього</div>
                          <div className="mt-1 text-lg font-semibold text-neutral-900">{guestsCount}</div>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2 xl:col-span-3">
                      <button type="button" onClick={handleFindRooms} disabled={loadingRooms} className={primaryButtonClass}>
                        {loadingRooms ? 'Пошук номерів...' : 'Підібрати номер'}
                      </button>
                    </div>
                    {roomsMessage ? <div className="rounded-2xl bg-neutral-100 px-3 py-3 text-sm text-neutral-700 md:col-span-2 xl:col-span-3">{roomsMessage}</div> : null}
                  </div>

                  {availableRooms.length > 0 ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {availableRooms.map((room) => (
                        <button
                          key={`${room.room_id}-${room.room_number}`}
                          type="button"
                          onClick={() => addDraftRoom(room)}
                          className="w-full rounded-3xl border border-[var(--crm-wine-border)] bg-white px-4 py-4 text-left text-neutral-900 shadow-sm transition hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-bold">Номер {room.room_number}</div>
                              <div className="mt-1 text-xs text-neutral-500">{room.building_name} · {room.room_type_name}</div>
                            </div>
                            <div className="text-base font-semibold">{formatMoney(room.price_total)}</div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1">{room.guests_count} гост.</span>
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1">{room.nights} ноч.</span>
                            <span className="rounded-full bg-[var(--crm-wine)] px-2.5 py-1 font-semibold text-white">Додати</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                  Номер уже додано з екрана доступності. За потреби можна відкрити цей блок і додати ще номер.
                </div>
              )}
            </section>

            <section className={sectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold sm:text-lg">3. Номер бронювання</div>
                <div className="rounded-full bg-[var(--crm-wine-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--crm-wine)]">{draftRooms.length}</div>
              </div>

              {draftRooms.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-600">Поки що жодного номера не додано.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {draftRooms.map((draftRoom, index) => (
                    <article key={draftRoom.key} className="rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-base font-bold">Номер {index + 1}: {draftRoom.room.room_number}</div>
                          <div className="mt-1 text-sm text-neutral-600">{draftRoom.room.building_name} · {draftRoom.room.room_type_name}</div>
                          <div className="mt-1 text-xs text-neutral-500">{draftRoom.checkIn} - {draftRoom.checkOut} · {draftRoom.guestsCount} гост.</div>
                        </div>
                        <button type="button" onClick={() => setDraftRooms((current) => current.filter((room) => room.key !== draftRoom.key))} className="inline-flex rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[var(--crm-wine)] shadow-sm">
                          Прибрати
                        </button>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-neutral-500">Всього</div>
                          <div className="mt-1 text-lg font-semibold text-neutral-900">{draftRoom.guestsCount}</div>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-neutral-500">Додаткові місця</div>
                          <div className="mt-1 font-medium text-neutral-900">
                            {getExtraBedSummaryLabel(draftRoom.paidExtraBedsCount, draftRoom.freeExtraBedsCount)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <CompositionField
                          label="Гості"
                          value={draftRoom.adultsCount}
                          onChange={(nextValue) => updateDraftRoomComposition(draftRoom.key, { adultsCount: nextValue })}
                        />
                        <CompositionField
                          label="Додаткові гості"
                          value={draftRoom.children6PlusCount}
                          onChange={(nextValue) => updateDraftRoomComposition(draftRoom.key, { children6PlusCount: nextValue })}
                        />
                        <CompositionField
                          label="До 6 років"
                          value={draftRoom.childrenUnder6Count}
                          onChange={(nextValue) => updateDraftRoomComposition(draftRoom.key, { childrenUnder6Count: nextValue })}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-medium">Базова сума, грн</span>
                          <input type="text" inputMode="numeric" value={draftRoom.priceBaseTotal} onChange={(e) => updateDraftRoom(draftRoom.key, { priceBaseTotal: sanitizeIntegerInput(e.target.value) })} className={fieldClass} />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium">Доп. місця, грн</span>
                          <input type="text" inputMode="numeric" value={draftRoom.priceExtraTotal} onChange={(e) => updateDraftRoom(draftRoom.key, { priceExtraTotal: sanitizeIntegerInput(e.target.value) })} className={fieldClass} />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium">Оплата готівкою, грн</span>
                          <input type="text" inputMode="numeric" value={draftRoom.paymentCash} onChange={(e) => updateDraftRoom(draftRoom.key, { paymentCash: sanitizeIntegerInput(e.target.value) })} className={fieldClass} />
                        </label>
                        <label className="block">
                          <span className="text-sm font-medium">Оплата карткою, грн</span>
                          <input type="text" inputMode="numeric" value={draftRoom.paymentCard} onChange={(e) => updateDraftRoom(draftRoom.key, { paymentCard: sanitizeIntegerInput(e.target.value) })} className={fieldClass} />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="text-sm font-medium">Коментар по номеру</span>
                          <textarea value={draftRoom.bookingNote} onChange={(e) => updateDraftRoom(draftRoom.key, { bookingNote: e.target.value })} rows={3} className={textAreaClass} />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={sectionClass}>
              <div className="text-base font-semibold sm:text-lg">4. Загальні параметри</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Статус бронювання</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'new' | 'confirmed')} className={fieldClass}>
                    <option value="new">Нове</option>
                    <option value="confirmed">Підтверджене</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Коли очікується оплата</span>
                  <select value={paymentDueStage} onChange={(e) => setPaymentDueStage(e.target.value as PaymentDueStage)} className={fieldClass}>
                    <option value="before_check_in">{getPaymentDueStageLabel('before_check_in')}</option>
                    <option value="at_check_in">{getPaymentDueStageLabel('at_check_in')}</option>
                    <option value="at_check_out">{getPaymentDueStageLabel('at_check_out')}</option>
                  </select>
                </label>
              </div>
            </section>
          </form>

          <aside className="space-y-3 xl:sticky xl:top-24">
            <section className={sectionClass}>
              <div className="text-base font-semibold sm:text-lg">Підсумок</div>
              <div className="mt-4 space-y-2 text-sm text-neutral-700">
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Гостей у пошуку</span><span className="font-medium">{guestsCount}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Орієнтовно платних доп. місць</span><span className="font-medium">{paidSearchExtraBedsCount}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Номерів</span><span className="font-medium">{draftRooms.length}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Вартість</span><span className="font-medium">{formatMoney(totalPrice)}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Оплачено</span><span className="font-medium">{formatMoney(totalPaid)}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Статус оплати</span><span className="font-medium">{getPaymentStatusLabel(paymentStatus)}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Оплата очікується</span><span className="font-medium">{getPaymentDueStageLabel(paymentDueStage)}</span></div>
                <div className="rounded-2xl bg-neutral-50 px-3 py-3 sm:flex sm:justify-between"><span>Залишок</span><span className="font-medium">{formatMoney(balance)}</span></div>
              </div>

              <button type="submit" form="booking-form" disabled={saving} className={`mt-4 ${primaryButtonClass}`}>
                {saving ? 'Створення бронювання...' : draftRooms.length > 1 ? 'Створити одне бронювання на всі номери' : 'Створити бронювання'}
              </button>
            </section>
          </aside>
        </div>
      </div>

      {bookingCreatedMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-created-title"
            className="w-full max-w-md rounded-[28px] border border-[var(--crm-vine-border)] bg-white px-5 py-5 shadow-2xl sm:px-6 sm:py-6"
          >
            <div id="booking-created-title" className="text-xl font-bold text-neutral-900">
              Бронювання записано
            </div>
            <div className="mt-3 text-sm leading-6 text-neutral-700">{bookingCreatedMessage}</div>
            <button type="button" onClick={handleCloseBookingCreatedMessage} className={`mt-5 ${primaryButtonClass}`}>
              Ок
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

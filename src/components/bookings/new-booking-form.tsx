'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { getDefaultPaymentDueStage, getPaymentDueStageLabel, type PaymentDueStage } from '@/lib/booking-note-meta'
import { addOneDay, dateInputToIso, formatDateForDisplay, formatDateInput, getNextDateInputValue, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
import {
  buildGuestCompositionSummary,
  getPaidExtraBedsCount,
  getTotalGuestsCount,
  type GuestComposition,
} from '@/lib/guest-composition'
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
  priceBaseTotal: string
  priceExtraTotal: string
  certificateApplied: boolean
  certificateAmount: string
  paymentAmount: string
}

type QueryRoomPayload = {
  roomId: string
  roomNumber: string
  buildingName: string
  roomTypeName: string
  baseCapacity: number
  maxCapacity: number
  basePricePerNight: number
  extraBedPricePerNight: number
}

type QueryRoomSelectionPayload = QueryRoomPayload & {
  checkIn: string
  checkOut: string
}

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5'
const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const textAreaClass =
  'mt-1.5 min-h-28 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'
const primaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)] disabled:opacity-60'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-sm font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:opacity-60'
const counterButtonClass =
  'flex h-12 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] text-xl font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)]'
const counterPrimaryButtonClass =
  'flex h-12 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] text-xl font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)]'

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
    priceBaseTotal: String(pricing.priceBaseTotal),
    priceExtraTotal: String(pricing.priceExtraTotal),
    certificateApplied: false,
    certificateAmount: '',
    paymentAmount: '',
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

function recalculateDraftRoomDates(
  room: DraftRoom,
  patch: Partial<Pick<DraftRoom, 'checkIn' | 'checkOut'>>
): DraftRoom {
  const nextCheckIn = patch.checkIn ?? room.checkIn
  const nextCheckOut =
    patch.checkOut ?? (patch.checkIn && patch.checkIn !== room.checkIn ? getNextDateInputValue(patch.checkIn) : room.checkOut)

  if (!isCompleteDateInput(nextCheckIn) || !isCompleteDateInput(nextCheckOut)) {
    return {
      ...room,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
    }
  }

  const checkInIso = dateInputToIso(nextCheckIn)
  const checkOutIso = dateInputToIso(nextCheckOut)

  if (!checkInIso || !checkOutIso || checkOutIso <= checkInIso) {
    return {
      ...room,
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
    }
  }

  const composition = getSearchComposition(room.adultsCount, room.childrenUnder6Count, room.children6PlusCount)
  const guestsCount = getTotalGuestsCount(composition)
  const paidExtraBedsCount = getPaidExtraBedsCount(composition, room.room.base_capacity)
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
    checkIn: nextCheckIn,
    checkOut: nextCheckOut,
    paidExtraBedsCount: pricing.paidExtraBedsCount,
    freeExtraBedsCount: pricing.freeExtraBedsCount,
    priceBaseTotal: String(pricing.priceBaseTotal),
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
  const certificateAmount = room.certificateApplied ? parseIntegerValue(room.certificateAmount) : 0
  const certificateInfo = certificateAmount > 0 ? `Оплата сертифікатом: ${certificateAmount} грн` : ''

  return [visibleNote, certificateInfo, summary, extraInfo].filter(Boolean).join('\n')
}

function getDraftRoomCertificateAmount(room: DraftRoom) {
  return room.certificateApplied ? parseIntegerValue(room.certificateAmount) : 0
}

function getDraftRoomTotalPrice(room: DraftRoom) {
  return parseIntegerValue(room.priceBaseTotal) + parseIntegerValue(room.priceExtraTotal)
}

function getDraftRoomDirectPaid(room: DraftRoom) {
  return parseIntegerValue(room.paymentAmount)
}

function createQueryRoomPayload(value: unknown): QueryRoomPayload | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const room = value as Record<string, unknown>

  if (
    typeof room.roomId !== 'string' ||
    typeof room.roomNumber !== 'string' ||
    typeof room.buildingName !== 'string' ||
    typeof room.roomTypeName !== 'string' ||
    typeof room.baseCapacity !== 'number' ||
    !Number.isFinite(room.baseCapacity) ||
    typeof room.maxCapacity !== 'number' ||
    !Number.isFinite(room.maxCapacity) ||
    typeof room.basePricePerNight !== 'number' ||
    !Number.isFinite(room.basePricePerNight) ||
    typeof room.extraBedPricePerNight !== 'number' ||
    !Number.isFinite(room.extraBedPricePerNight)
  ) {
    return null
  }

  return {
    roomId: room.roomId,
    roomNumber: room.roomNumber,
    buildingName: room.buildingName,
    roomTypeName: room.roomTypeName,
    baseCapacity: room.baseCapacity,
    maxCapacity: room.maxCapacity,
    basePricePerNight: room.basePricePerNight,
    extraBedPricePerNight: room.extraBedPricePerNight,
  }
}

function buildDraftRoomFromQueryPayload(
  queryRoom: QueryRoomPayload,
  checkInIso: string,
  checkOutIso: string,
  guestsCount: number,
  composition: GuestComposition
) {
  const paidExtraBedsCount = getPaidExtraBedsCount(composition, queryRoom.baseCapacity)
  const pricing = calculateBookingPrice({
    checkInDate: checkInIso,
    checkOutDate: checkOutIso,
    guestsCount,
    baseCapacity: queryRoom.baseCapacity,
    basePricePerNight: queryRoom.basePricePerNight,
    extraBedPricePerNight: queryRoom.extraBedPricePerNight,
    paidExtraBedsCount,
  })

  return createDraftRoom(
    {
      room_id: queryRoom.roomId,
      room_number: queryRoom.roomNumber,
      building_name: queryRoom.buildingName,
      room_type_name: queryRoom.roomTypeName,
      base_capacity: queryRoom.baseCapacity,
      max_capacity: queryRoom.maxCapacity,
      base_price_per_night: queryRoom.basePricePerNight,
      extra_bed_price_per_night: queryRoom.extraBedPricePerNight,
      guests_count: guestsCount,
      nights: pricing.nights,
      extra_beds_count: pricing.extraBedsCount,
      free_extra_beds_count: pricing.freeExtraBedsCount,
      price_base_total: pricing.priceBaseTotal,
      price_extra_total: pricing.priceExtraTotal,
      price_total: pricing.priceTotal,
      free_dates: [],
      free_dates_count: 0,
      is_fully_available: true,
    },
    isoDateToInputValue(checkInIso),
    isoDateToInputValue(checkOutIso),
    composition
  )
}

function createQueryRoomSelectionPayload(value: unknown): QueryRoomSelectionPayload | null {
  const room = createQueryRoomPayload(value)

  if (!room || !value || typeof value !== 'object') {
    return null
  }

  const payload = value as Record<string, unknown>

  if (typeof payload.checkIn !== 'string' || typeof payload.checkOut !== 'string') {
    return null
  }

  return {
    ...room,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
  }
}

function buildDraftRoomFromSelectionPayload(
  queryRoom: QueryRoomSelectionPayload,
  guestsCount: number,
  composition: GuestComposition
) {
  return buildDraftRoomFromQueryPayload(queryRoom, queryRoom.checkIn, queryRoom.checkOut, guestsCount, composition)
}

function readDraftRoomsFromQuery() {
  if (typeof window === 'undefined') {
    return []
  }

  const params = new URLSearchParams(window.location.search)
  const checkIn = params.get('checkIn')
  const checkOut = params.get('checkOut')
  const guestsCount = parsePositiveNumber(params.get('guestsCount'))
  const adultsCount = parsePositiveNumber(params.get('adultsCount'))
  const childrenUnder6Count = parsePositiveNumber(params.get('childrenUnder6Count'))
  const children6PlusCount = parsePositiveNumber(params.get('children6PlusCount'))

  if (!guestsCount) {
    return []
  }

  const composition =
    adultsCount !== null && childrenUnder6Count !== null && children6PlusCount !== null
      ? getSearchComposition(adultsCount, childrenUnder6Count, children6PlusCount)
      : getDefaultCompositionFromGuestsCount(guestsCount)

  const serializedRoomSelections = params.get('roomSelections')

  if (serializedRoomSelections) {
    try {
      const parsedSelections = JSON.parse(serializedRoomSelections)

      if (Array.isArray(parsedSelections)) {
        const draftRooms = parsedSelections.reduce<DraftRoom[]>((result, currentSelection) => {
          const queryRoomSelection = createQueryRoomSelectionPayload(currentSelection)

          if (!queryRoomSelection) {
            return result
          }

          result.push(buildDraftRoomFromSelectionPayload(queryRoomSelection, guestsCount, composition))
          return result
        }, [])

        if (draftRooms.length > 0) {
          return draftRooms
        }
      }
    } catch {
      return []
    }
  }

  if (!checkIn || !checkOut) {
    return []
  }

  const serializedRooms = params.get('rooms')

  if (serializedRooms) {
    try {
      const parsedRooms = JSON.parse(serializedRooms)

      if (Array.isArray(parsedRooms)) {
        const draftRooms = parsedRooms.reduce<DraftRoom[]>((result, currentRoom) => {
          const queryRoom = createQueryRoomPayload(currentRoom)

          if (!queryRoom) {
            return result
          }

          result.push(buildDraftRoomFromQueryPayload(queryRoom, checkIn, checkOut, guestsCount, composition))
          return result
        }, [])

        if (draftRooms.length > 0) {
          return draftRooms
        }
      }
    } catch {
      return []
    }
  }

  const singleRoom = createQueryRoomPayload({
    roomId: params.get('roomId'),
    roomNumber: params.get('roomNumber'),
    buildingName: params.get('buildingName'),
    roomTypeName: params.get('roomTypeName'),
    baseCapacity: parsePositiveNumber(params.get('baseCapacity')),
    maxCapacity: parsePositiveNumber(params.get('maxCapacity')),
    basePricePerNight: parsePositiveNumber(params.get('basePricePerNight')),
    extraBedPricePerNight: parsePositiveNumber(params.get('extraBedPricePerNight')),
  })

  if (!singleRoom) {
    return []
  }

  return [buildDraftRoomFromQueryPayload(singleRoom, checkIn, checkOut, guestsCount, composition)]
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
  const availableRoomsRef = useRef<HTMLDivElement | null>(null)

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
    const nextDraftRooms = readDraftRoomsFromQuery()

    if (nextDraftRooms.length > 0) {
      const firstDraftRoom = nextDraftRooms[0]

      setCheckIn(firstDraftRoom.checkIn)
      setCheckOut(firstDraftRoom.checkOut)
      setAdultsCount(firstDraftRoom.adultsCount)
      setChildrenUnder6Count(firstDraftRoom.childrenUnder6Count)
      setChildren6PlusCount(firstDraftRoom.children6PlusCount)
      setDraftRooms(nextDraftRooms)
      setIsAddRoomSectionOpen(false)
      setRoomsMessage(nextDraftRooms.length > 1 ? 'Номери додано з екрана доступності.' : 'Номер додано з екрана доступності.')
    }
  }, [])

  useEffect(() => {
    if (loadingRooms || availableRooms.length === 0 || !availableRoomsRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const rect = availableRoomsRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      const targetTop = Math.max(0, window.scrollY + rect.top - 112)

      window.scrollTo({
        top: targetTop,
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [availableRooms, loadingRooms])

  const totalPrice = draftRooms.reduce((sum, room) => sum + getDraftRoomTotalPrice(room), 0)
  const totalGuestsInBooking = draftRooms.reduce((sum, room) => sum + room.guestsCount, 0)
  const totalExtraBedsInBooking = draftRooms.reduce((sum, room) => sum + room.paidExtraBedsCount + room.freeExtraBedsCount, 0)

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

  function removeDraftRoom(key: string) {
    setDraftRooms((current) => current.filter((room) => room.key !== key))
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

  function updateDraftRoomDates(key: string, patch: Partial<Pick<DraftRoom, 'checkIn' | 'checkOut'>>) {
    let nextError = ''

    setDraftRooms((current) =>
      current.map((room) => {
        if (room.key !== key) {
          return room
        }

        const nextRoom = recalculateDraftRoomDates(room, patch)

        if (isCompleteDateInput(nextRoom.checkIn) && isCompleteDateInput(nextRoom.checkOut)) {
          const checkInIso = dateInputToIso(nextRoom.checkIn)
          const checkOutIso = dateInputToIso(nextRoom.checkOut)

          if (!checkInIso || !checkOutIso || checkOutIso <= checkInIso) {
            nextError = `У номері ${room.room.room_number} дата виїзду має бути пізніше за дату заїзду.`
          }
        }

        return nextRoom
      })
    )

    setError(nextError)
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

    for (const room of draftRooms) {
      if (!isCompleteDateInput(room.checkIn) || !isCompleteDateInput(room.checkOut)) {
        setError(`Перевір дати у номері ${room.room.room_number}.`)
        return
      }

      const checkInIso = dateInputToIso(room.checkIn)
      const checkOutIso = dateInputToIso(room.checkOut)

      if (!checkInIso || !checkOutIso || checkOutIso <= checkInIso) {
        setError(`У номері ${room.room.room_number} дата виїзду має бути пізніше за дату заїзду.`)
        return
      }
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
            booking_note: buildBookingNoteWithGuestSummary(guestNote, room),
            payment_due_stage: room.certificateApplied ? 'before_check_in' : paymentDueStage,
            status,
            payment_cash_amount: parseIntegerValue(room.paymentAmount),
            payment_card_amount: 0,
            certificate_amount: getDraftRoomCertificateAmount(room),
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

        <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] 2xl:items-start">
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
                <label className="block min-w-0">
                  <span className="text-sm font-medium">Дата народження</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={birthDate}
                    onChange={(e) => setBirthDate(formatDateInput(e.target.value))}
                    placeholder="ДД-ММ-РРРР"
                    className={fieldClass}
                  />
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
                  <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 2xl:grid-cols-3">
                    <label className="block min-w-0">
                      <span className="block text-center text-sm font-medium">Дата заїзду</span>
                      <DatePickerField
                        value={checkIn}
                        onChange={(value) => {
                          setCheckIn(value)
                          setCheckOut(getNextDateInputValue(value))
                        }}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="block text-center text-sm font-medium">Дата виїзду</span>
                      <DatePickerField value={checkOut} onChange={setCheckOut} className={fieldClass} />
                    </label>
                    <div className="col-span-2 rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3.5 py-3.5 2xl:col-span-3 sm:px-4 sm:py-4">
                      <div className="text-sm font-semibold text-[var(--crm-wine)]">Склад гостей для пошуку номера</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
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
                    <div className="col-span-2 2xl:col-span-3">
                      <button type="button" onClick={handleFindRooms} disabled={loadingRooms} className={primaryButtonClass}>
                        {loadingRooms ? 'Пошук номерів...' : 'Підібрати номер'}
                      </button>
                    </div>
                    {roomsMessage ? <div className="col-span-2 rounded-2xl bg-neutral-100 px-3 py-3 text-sm text-neutral-700 2xl:col-span-3">{roomsMessage}</div> : null}
                  </div>

                  {availableRooms.length > 0 ? (
                    <div ref={availableRoomsRef} className="mt-4 space-y-3">
                      <div className="text-sm font-semibold text-[var(--crm-wine-dark)]">Доступні номери</div>
                      <div className="grid gap-3 xl:grid-cols-2">
                      {availableRooms.map((room) => (
                        <button
                          key={`${room.room_id}-${room.room_number}`}
                          type="button"
                          onClick={() => addDraftRoom(room)}
                          className="w-full rounded-3xl border border-[var(--crm-wine-border)] bg-white px-3.5 py-3.5 text-left text-neutral-900 shadow-sm transition hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)] sm:px-4 sm:py-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-base font-bold">
                                <span>{`Номер ${room.room_number} `}</span>
                                <span className="text-sm font-medium text-neutral-600">
                                  {`(${room.building_name}, ${room.room_type_name})`}
                                </span>
                              </div>
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
                  {draftRooms.map((draftRoom, index) => {
                    const certificateAmount = getDraftRoomCertificateAmount(draftRoom)
                    const roomTotalPrice = getDraftRoomTotalPrice(draftRoom)
                    const directPaid = getDraftRoomDirectPaid(draftRoom)
                    const roomTotalPaid = directPaid + certificateAmount
                    const roomBalance = Math.max(0, roomTotalPrice - roomTotalPaid)
                    const roomCertificateSurplus = Math.max(0, certificateAmount - roomTotalPrice)

                    return (
                      <article key={draftRoom.key} className="rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3.5 py-3.5 shadow-sm sm:px-4 sm:py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-base font-bold">
                              {`Номер ${index + 1}: ${draftRoom.room.room_number} (${draftRoom.room.room_type_name}, ${draftRoom.room.building_name})`}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">{draftRoom.checkIn} - {draftRoom.checkOut} · {draftRoom.guestsCount} гост.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDraftRoom(draftRoom.key)}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--crm-wine)] bg-[var(--crm-wine-soft)] px-3.5 py-2 text-sm font-semibold text-[var(--crm-wine)] shadow-sm transition hover:bg-[var(--crm-wine-soft-hover)]"
                          >
                            Прибрати номер
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
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
                          <div className="col-span-2 rounded-2xl bg-white px-3 py-3 text-sm text-neutral-700 shadow-sm">
                            <div className="text-xs uppercase tracking-wide text-neutral-500">До сплати</div>
                            <div className="mt-1 text-lg font-semibold text-neutral-900">{formatMoney(roomTotalPrice)}</div>
                          </div>
                        </div>

                        <div className="mt-4 grid min-w-0 grid-cols-2 gap-3">
                          <label className="block min-w-0">
                            <span className="block text-center text-sm font-medium">Дата заїзду</span>
                            <DatePickerField
                              value={draftRoom.checkIn}
                              onChange={(value) => updateDraftRoomDates(draftRoom.key, { checkIn: value })}
                              className={fieldClass}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="block text-center text-sm font-medium">Дата виїзду</span>
                            <DatePickerField
                              value={draftRoom.checkOut}
                              onChange={(value) => updateDraftRoomDates(draftRoom.key, { checkOut: value })}
                              className={fieldClass}
                            />
                          </label>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
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

                        <div className="mt-4 rounded-3xl border border-[var(--crm-wine-border)] bg-white px-3.5 py-3.5 shadow-sm sm:px-4 sm:py-4">
                          <label className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-neutral-900">
                            <input
                              type="checkbox"
                              checked={draftRoom.certificateApplied}
                              onChange={(e) =>
                                updateDraftRoom(draftRoom.key, {
                                  certificateApplied: e.target.checked,
                                  certificateAmount: e.target.checked
                                    ? draftRoom.certificateAmount || String(roomTotalPrice)
                                    : '',
                                })
                              }
                              className="h-5 w-5 rounded border-[var(--crm-wine-border)] text-[var(--crm-wine)] accent-[var(--crm-wine)]"
                            />
                            Проживання по сертифікату
                          </label>

                          {draftRoom.certificateApplied ? (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <label className="block">
                                <span className="text-sm font-medium">Сума сертифіката, грн</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={draftRoom.certificateAmount}
                                  onChange={(e) =>
                                    updateDraftRoom(draftRoom.key, {
                                      certificateAmount: sanitizeIntegerInput(e.target.value),
                                    })
                                  }
                                  className={fieldClass}
                                />
                              </label>
                              <div className="rounded-2xl bg-[var(--crm-vine-soft)] px-3 py-3 text-sm text-[var(--crm-vine-dark)] shadow-sm">
                                <div className="font-semibold">Сертифікат враховано в оплаті</div>
                                <div className="mt-1">Покриття: {formatMoney(certificateAmount)}</div>
                                {roomBalance > 0 ? <div className="mt-1">Гість має доплатити: {formatMoney(roomBalance)}</div> : null}
                                {roomCertificateSurplus > 0 ? <div className="mt-1">Сертифікат перекриває на: {formatMoney(roomCertificateSurplus)}</div> : null}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-sm font-medium">Вартість ном.</span>
                            <input type="text" inputMode="numeric" value={draftRoom.priceBaseTotal} onChange={(e) => updateDraftRoom(draftRoom.key, { priceBaseTotal: sanitizeIntegerInput(e.target.value) })} className={fieldClass} />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium">Доп. місця, грн</span>
                            <input type="text" inputMode="numeric" value={draftRoom.priceExtraTotal} onChange={(e) => updateDraftRoom(draftRoom.key, { priceExtraTotal: sanitizeIntegerInput(e.target.value) })} className={fieldClass} />
                          </label>
                          <label className="block col-span-2">
                            <span className="text-sm font-medium">Оплата, грн</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={draftRoom.paymentAmount}
                              onFocus={() => {
                                if (parseIntegerValue(draftRoom.paymentAmount) === 0) {
                                  updateDraftRoom(draftRoom.key, { paymentAmount: '' })
                                }
                              }}
                              onChange={(e) => updateDraftRoom(draftRoom.key, { paymentAmount: sanitizeIntegerInput(e.target.value) })}
                              className={fieldClass}
                            />
                          </label>
                          {draftRoom.certificateApplied ? (
                            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700 shadow-sm">
                              <div className="text-xs uppercase tracking-wide text-neutral-500">Вже покрито</div>
                              <div className="mt-1 font-semibold text-neutral-900">{formatMoney(roomTotalPaid)}</div>
                            </div>
                          ) : null}
                          {draftRoom.certificateApplied ? (
                            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700 shadow-sm">
                              <div className="text-xs uppercase tracking-wide text-neutral-500">Залишок гостя</div>
                              <div className="mt-1 font-semibold text-neutral-900">{formatMoney(roomBalance)}</div>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className={sectionClass}>
              <div className="text-base font-semibold sm:text-lg">4. Загальні параметри</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
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

          <aside className="space-y-3 2xl:sticky 2xl:top-24">
            <section className={sectionClass}>
              <div className="text-base font-semibold sm:text-lg">Підсумок</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Номерів</div>
                  <div className="mt-1.5 text-xl font-bold leading-none text-neutral-900">{draftRooms.length}</div>
                </div>
                <div className="rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Гостей</div>
                  <div className="mt-1.5 text-xl font-bold leading-none text-neutral-900">{totalGuestsInBooking}</div>
                </div>
                <div className="rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Доп. місця</div>
                  <div className="mt-1.5 text-xl font-bold leading-none text-neutral-900">{totalExtraBedsInBooking}</div>
                </div>
                <div className="rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-wine-soft)] px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--crm-wine-dark)]">Вартість</div>
                  <div className="mt-1.5 text-base font-bold leading-tight text-[var(--crm-wine-dark)]">{formatMoney(totalPrice)}</div>
                </div>
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

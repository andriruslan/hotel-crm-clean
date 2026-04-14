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

async function parseApiResponse(response: Response) {
  const rawText = await response.text()

  if (!rawText) {
    if (!response.ok) {
      throw new Error(`Сервер повернув помилку ${response.status}.`)
    }

    return { ok: true } as ApiResponse
  }

  try {
    return JSON.parse(rawText) as ApiResponse
  } catch {
    const compactText = rawText
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!response.ok) {
      throw new Error(compactText || `Сервер повернув помилку ${response.status}.`)
    }

    throw new Error('Сервер повернув неочікувану відповідь.')
  }
}

type BookingRoomQueryItem = {
  roomId: string
  roomNumber: string
  buildingName: string
  roomTypeName: string
  baseCapacity: number
  maxCapacity: number
  basePricePerNight: number
  extraBedPricePerNight: number
}

const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[16px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200'

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5'
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
  const params = createBaseBookingParams(checkIn, checkOut, composition)
  const serializedRoom = serializeBookingRoom(item)

  params.set('roomId', serializedRoom.roomId)
  params.set('roomNumber', serializedRoom.roomNumber)
  params.set('buildingName', serializedRoom.buildingName)
  params.set('roomTypeName', serializedRoom.roomTypeName)
  params.set('baseCapacity', String(serializedRoom.baseCapacity))
  params.set('maxCapacity', String(serializedRoom.maxCapacity))
  params.set('basePricePerNight', String(serializedRoom.basePricePerNight))
  params.set('extraBedPricePerNight', String(serializedRoom.extraBedPricePerNight))

  return `/bookings/new?${params.toString()}`
}

function createBaseBookingParams(checkIn: string, checkOut: string, composition: GuestComposition) {
  const guestsCount = getTotalGuestsCount(composition)
  const checkInIso = dateInputToIso(checkIn)
  const checkOutIso = dateInputToIso(checkOut)

  return new URLSearchParams({
    checkIn: checkInIso,
    checkOut: checkOutIso,
    guestsCount: String(guestsCount),
    adultsCount: String(composition.adultsCount),
    childrenUnder6Count: String(composition.childrenUnder6Count),
    children6PlusCount: String(composition.children6PlusCount),
  })
}

function serializeBookingRoom(item: AvailabilityItem): BookingRoomQueryItem {
  return {
    roomId: item.room_id,
    roomNumber: item.room_number,
    buildingName: item.building_name,
    roomTypeName: item.room_type_name,
    baseCapacity: item.base_capacity,
    maxCapacity: item.max_capacity,
    basePricePerNight: item.base_price_per_night,
    extraBedPricePerNight: item.extra_bed_price_per_night,
  }
}

function createMultiRoomBookingHref(
  items: AvailabilityItem[],
  checkIn: string,
  checkOut: string,
  composition: GuestComposition
) {
  const params = createBaseBookingParams(checkIn, checkOut, composition)
  params.set('rooms', JSON.stringify(items.map(serializeBookingRoom)))

  return `/bookings/new?${params.toString()}`
}

function createDailyBookingHref(item: AvailabilityItem, dateValue: string, composition: GuestComposition) {
  const checkIn = isoDateToInputValue(dateValue)
  const checkOut = isoDateToInputValue(addOneDay(dateValue))

  return createBookingHref(item, checkIn, checkOut, composition)
}

function getWeekdayShortLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(parsed)
}

function getCompactDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return isoDateToInputValue(value)
  }

  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(parsed)
}

function MultiDayAvailabilityMatrix({
  items,
  selectedDates,
  createCellHref,
  isMultiSelectEnabled,
  selectedRoomIds,
  selectedBookingDate,
  onToggleRoomAtDate,
}: {
  items: AvailabilityItem[]
  selectedDates: string[]
  createCellHref: (item: AvailabilityItem, dateValue: string) => string
  isMultiSelectEnabled: boolean
  selectedRoomIds: string[]
  selectedBookingDate: string
  onToggleRoomAtDate: (roomId: string, dateValue: string) => void
}) {
  const columnTemplate = `minmax(132px, 132px) repeat(${selectedDates.length}, minmax(72px, 72px))`
  const selectedRoomIdsSet = new Set(selectedRoomIds)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-[var(--crm-vine-soft)] px-3 py-1.5 font-semibold text-[var(--crm-vine-dark)]">
          Клітинка зелена = вільно
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 font-semibold text-neutral-600">
          Сіра = зайнято
        </span>
      </div>

      <div className="text-xs font-medium text-neutral-500 sm:text-sm">На телефоні таблицю можна гортати вліво та вправо.</div>

      <div className="-mx-1 overflow-hidden rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] shadow-sm sm:mx-0">
        <div className="overflow-x-auto px-1 pb-1 sm:px-0 sm:pb-0">
          <div className="min-w-max">
            <div className="grid border-b border-[var(--crm-wine-border)] bg-[var(--crm-panel)]" style={{ gridTemplateColumns: columnTemplate }}>
              <div className="sticky left-0 z-20 flex min-h-[64px] items-center border-r border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-2.5 py-2.5 sm:px-3 sm:py-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Номер</div>
                  <div className="text-xs text-neutral-500">Тицни по даті</div>
                </div>
              </div>
              {selectedDates.map((dateValue) => (
                <div
                  key={dateValue}
                  className="flex min-h-[64px] flex-col items-center justify-center border-l border-[var(--crm-wine-border)] px-1.5 py-2 text-center sm:px-2 sm:py-3"
                >
                  <div className="text-sm font-bold leading-none text-neutral-900 sm:text-base">{getCompactDateLabel(dateValue)}</div>
                  <div className="mt-1 text-xs font-medium uppercase text-neutral-500">{getWeekdayShortLabel(dateValue)}</div>
                </div>
              ))}
            </div>

            {items.map((item) => {
              const freeDatesSet = new Set(item.free_dates)
              const isSelected = selectedRoomIdsSet.has(item.room_id)
              const leftCellClassName = `sticky left-0 z-10 flex min-h-[78px] flex-col justify-center border-r border-[var(--crm-wine-border)] px-2.5 py-2.5 sm:min-h-[88px] sm:px-3 sm:py-3 ${
                item.is_fully_available ? 'bg-[var(--crm-wine-soft)]' : 'bg-white/95'
              }`

              return (
                <div
                  key={item.room_id}
                  className="grid border-b border-[var(--crm-wine-border)] last:border-b-0"
                  style={{ gridTemplateColumns: columnTemplate }}
                >
                  <div
                    className={`${leftCellClassName} ${isSelected ? 'ring-2 ring-[var(--crm-wine)] ring-inset' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-base font-bold leading-tight text-neutral-900 sm:text-lg">Номер {item.room_number}</div>
                      {isMultiSelectEnabled && isSelected ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--crm-wine)] bg-[var(--crm-wine)] px-2 text-[11px] font-semibold text-white">
                          Обрано
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-neutral-500">
                      {item.building_name}, {item.room_type_name}
                    </div>
                  </div>

                  {selectedDates.map((dateValue) => {
                    const isFree = freeDatesSet.has(dateValue)
                    const isSelectedDate = isMultiSelectEnabled && isSelected && selectedBookingDate === dateValue
                    const cellClassName = `min-h-[78px] border-l border-[var(--crm-wine-border)] px-1.5 py-1.5 sm:min-h-[88px] sm:px-2 sm:py-2 ${
                      isFree ? 'bg-[var(--crm-vine-soft)]' : 'bg-neutral-100'
                    } ${isSelectedDate ? 'ring-2 ring-[var(--crm-wine)] ring-inset' : ''}`
                    const contentClassName = `flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-sm sm:h-9 sm:w-9 ${
                      isFree
                        ? 'bg-white text-[var(--crm-vine-dark)]'
                        : 'bg-neutral-200 text-neutral-400'
                    }`

                    if (!isFree) {
                      return (
                        <div key={`${item.room_id}-${dateValue}`} className={`flex items-center justify-center ${cellClassName}`}>
                          <div className={contentClassName}>—</div>
                        </div>
                      )
                    }

                    if (isMultiSelectEnabled) {
                      return (
                        <button
                          key={`${item.room_id}-${dateValue}`}
                          type="button"
                          onClick={() => onToggleRoomAtDate(item.room_id, dateValue)}
                          className={`flex w-full items-center justify-center transition hover:brightness-[0.98] ${cellClassName}`}
                        >
                          <div className={contentClassName}>•</div>
                        </button>
                      )
                    }

                    return (
                      <Link
                        key={`${item.room_id}-${dateValue}`}
                        href={createCellHref(item, dateValue)}
                        className={`flex items-center justify-center transition hover:brightness-[0.98] ${cellClassName}`}
                        scroll={false}
                      >
                        <div className={contentClassName}>•</div>
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SingleDayAvailabilityGrid({
  items,
  createHref,
  isMultiSelectEnabled,
  selectedRoomIds,
  onToggleRoom,
}: {
  items: AvailabilityItem[]
  createHref: (item: AvailabilityItem) => string
  isMultiSelectEnabled: boolean
  selectedRoomIds: string[]
  onToggleRoom: (roomId: string) => void
}) {
  return (
    <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const isSelected = selectedRoomIds.includes(item.room_id)

        if (isMultiSelectEnabled) {
          return (
            <button
              key={item.room_id}
              type="button"
              onClick={() => onToggleRoom(item.room_id)}
              className={`w-full rounded-3xl border bg-white/90 px-3.5 py-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--crm-panel)] hover:shadow-md sm:px-4 sm:py-4 ${
                isSelected
                  ? 'border-[var(--crm-wine)] ring-2 ring-[var(--crm-wine)] ring-inset'
                  : 'border-[var(--crm-wine-border)] hover:border-[var(--crm-wine)]'
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-base font-bold leading-tight sm:text-lg">Номер {item.room_number}</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-500">{item.building_name} · {item.room_type_name}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                    isSelected ? 'bg-[var(--crm-wine)] text-white' : 'bg-white text-[var(--crm-wine)]'
                  }`}
                >
                  {isSelected ? 'Обрано' : 'Обрати'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-neutral-700">
                <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">доп. місць: {item.extra_beds_count + item.free_extra_beds_count}</span>
                <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">вільний на {isoDateToInputValue(item.free_dates[0] || '')}</span>
              </div>
            </button>
          )
        }

        return (
          <Link
            key={item.room_id}
            href={createHref(item)}
            className="rounded-3xl border border-[var(--crm-wine-border)] bg-white/90 px-3.5 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)] hover:shadow-md sm:px-4 sm:py-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-base font-bold leading-tight sm:text-lg">Номер {item.room_number}</div>
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
        )
      })}
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
  const [isMultiSelectEnabled, setIsMultiSelectEnabled] = useState(false)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [selectedBookingDate, setSelectedBookingDate] = useState('')
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
      const data = await parseApiResponse(response)

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
      setSelectedRoomIds([])
      setSelectedBookingDate('')
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
  const selectedItems = useMemo(
    () => items.filter((item) => selectedRoomIds.includes(item.room_id)),
    [items, selectedRoomIds]
  )
  const showDailyBreakdown =
    Boolean(selectedCheckInIso) && Boolean(selectedCheckOutIso) && getNights(selectedCheckInIso, selectedCheckOutIso) > 1

  function handleToggleMultiSelect(enabled: boolean) {
    setIsMultiSelectEnabled(enabled)

    if (!enabled) {
      setSelectedRoomIds([])
      setSelectedBookingDate('')
    }
  }

  function handleToggleRoom(roomId: string) {
    setSelectedRoomIds((current) => {
      const nextSelectedRoomIds = current.includes(roomId)
        ? current.filter((currentRoomId) => currentRoomId !== roomId)
        : [...current, roomId]

      if (nextSelectedRoomIds.length === 0) {
        setSelectedBookingDate('')
      }

      return nextSelectedRoomIds
    })
  }

  function handleToggleRoomAtDate(roomId: string, dateValue: string) {
    setSelectedRoomIds((current) => {
      if (!selectedBookingDate || selectedBookingDate !== dateValue) {
        setSelectedBookingDate(dateValue)
        return [roomId]
      }

      const nextSelectedRoomIds = current.includes(roomId)
        ? current.filter((currentRoomId) => currentRoomId !== roomId)
        : [...current, roomId]

      if (nextSelectedRoomIds.length === 0) {
        setSelectedBookingDate('')
      }

      return nextSelectedRoomIds
    })
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:items-start">
          <section className={`${sectionClass} xl:sticky xl:top-24`}>
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
                    <div className="text-lg font-semibold text-neutral-900">
                      {showDailyBreakdown ? 'Вільні номери по днях' : 'Вільні номери'}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-neutral-500">
                    {showDailyBreakdown ? `${selectedDates.length} дн.` : `${items.length} номер(и)`}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <label className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm">
                    <input
                      type="checkbox"
                      checked={isMultiSelectEnabled}
                      onChange={(e) => handleToggleMultiSelect(e.target.checked)}
                      className="h-5 w-5 rounded border-[var(--crm-wine-border)] text-[var(--crm-wine)] accent-[var(--crm-wine)]"
                    />
                    Обрати кілька номерів
                  </label>

                  {isMultiSelectEnabled ? (
                    selectedItems.length > 0 && (!showDailyBreakdown || selectedBookingDate) ? (
                      <Link
                        href={createMultiRoomBookingHref(
                          selectedItems,
                          showDailyBreakdown ? isoDateToInputValue(selectedBookingDate) : checkIn,
                          showDailyBreakdown ? isoDateToInputValue(addOneDay(selectedBookingDate)) : checkOut,
                          searchComposition
                        )}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--crm-wine)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--crm-wine-dark)]"
                      >
                        {showDailyBreakdown
                          ? `Перейти з ${selectedItems.length} номер(и) на ${isoDateToInputValue(selectedBookingDate)}`
                          : `Перейти з ${selectedItems.length} номер(и)`}
                      </Link>
                    ) : (
                      <div className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500">
                        {showDailyBreakdown ? 'Обери зелені клітинки на одну дату' : 'Обери номери'}
                      </div>
                    )
                  ) : null}
                </div>

                <div className="mt-4">
                  {showDailyBreakdown ? (
                    <MultiDayAvailabilityMatrix
                      items={items}
                      selectedDates={selectedDates}
                      createCellHref={(item, dateValue) => createDailyBookingHref(item, dateValue, searchComposition)}
                      isMultiSelectEnabled={isMultiSelectEnabled}
                      selectedRoomIds={selectedRoomIds}
                      selectedBookingDate={selectedBookingDate}
                      onToggleRoomAtDate={handleToggleRoomAtDate}
                    />
                  ) : (
                    <SingleDayAvailabilityGrid
                      items={items.filter((item) => item.is_fully_available)}
                      createHref={(item) => createBookingHref(item, checkIn, checkOut, searchComposition)}
                      isMultiSelectEnabled={isMultiSelectEnabled}
                      selectedRoomIds={selectedRoomIds}
                      onToggleRoom={handleToggleRoom}
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

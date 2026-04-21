'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DatePickerField } from '@/components/ui/date-picker-field'
import type { AvailabilityItem } from '@/types/availability'
import { addDays, addOneDay, dateInputToIso, getDatesInRange, getNextDateInputValue, getNights, getTodayDate, isoDateToInputValue, isCompleteDateInput } from '@/lib/dates'
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

type BookingRoomSelectionQueryItem = BookingRoomQueryItem & {
  checkIn: string
  checkOut: string
}

type MatrixSelection = {
  roomId: string
  dateValue: string
}

type BuildingFilterValue = 'all' | '1' | '2' | '3'
type RoomTypeFilterValue = 'all' | 'lux' | 'semi_lux' | 'standard'

const buildingFilterOptions: Array<{ value: BuildingFilterValue; label: string }> = [
  { value: 'all', label: '\u0423\u0441\u0456 \u043a\u043e\u0440\u043f.' },
  { value: '1', label: '1 \u041a\u043e\u0440\u043f.' },
  { value: '2', label: '2 \u041a\u043e\u0440\u043f.' },
  { value: '3', label: '3 \u041a\u043e\u0440\u043f.' },
]

const roomTypeFilterOptions: Array<{ value: RoomTypeFilterValue; label: string }> = [
  { value: 'all', label: '\u0423\u0441\u0456 \u0442\u0438\u043f\u0438' },
  { value: 'lux', label: '\u041b\u044e\u043a\u0441' },
  { value: 'semi_lux', label: '\u041d\u0430\u043f\u0456\u0432\u041b.' },
  { value: 'standard', label: '\u0421\u0442\u0430\u043d.' },
]

const fieldClass =
  'mt-1.5 h-12 w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[15px] text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-4 focus:ring-neutral-200 sm:text-[16px] lg:h-10 lg:px-3 lg:text-[14px]'

const sectionClass = 'rounded-3xl border border-[var(--crm-wine-border)] bg-white/95 px-3.5 py-3.5 shadow-sm sm:px-5 sm:py-5'
const primaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm lg:h-10 lg:text-[12px]'
const secondaryButtonClass =
  'h-12 w-full rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] px-4 text-[13px] font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm lg:h-10 lg:text-[12px]'
const counterButtonClass =
  'flex h-12 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine)] bg-[color:rgba(143,45,86,0.12)] text-xl font-semibold text-[var(--crm-wine-dark)] shadow-[0_8px_20px_rgba(143,45,86,0.1)] transition hover:bg-[var(--crm-wine-soft-hover)] lg:h-10 lg:text-lg'
const counterPrimaryButtonClass =
  'flex h-12 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] text-xl font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)] lg:h-10 lg:text-lg'

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
      <span className="text-[13px] font-medium text-neutral-800 sm:text-sm lg:text-[12px]">{label}</span>
      <div className="mt-1.5 grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2 lg:mt-1 lg:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] lg:gap-1.5">
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

function getMatrixSelectionKey(roomId: string, dateValue: string) {
  return `${roomId}::${dateValue}`
}

function parseMatrixSelectionKey(key: string): MatrixSelection | null {
  const [roomId, dateValue] = key.split('::')

  if (!roomId || !dateValue) {
    return null
  }

  return { roomId, dateValue }
}

function buildRoomSelectionsFromMatrix(
  items: AvailabilityItem[],
  selectionKeys: string[]
): BookingRoomSelectionQueryItem[] {
  const itemsByRoomId = new Map(items.map((item) => [item.room_id, item]))
  const datesByRoomId = new Map<string, string[]>()

  for (const key of selectionKeys) {
    const selection = parseMatrixSelectionKey(key)

    if (!selection) {
      continue
    }

    const currentDates = datesByRoomId.get(selection.roomId) || []

    if (!currentDates.includes(selection.dateValue)) {
      currentDates.push(selection.dateValue)
    }

    datesByRoomId.set(selection.roomId, currentDates)
  }

  const result: BookingRoomSelectionQueryItem[] = []

  for (const [roomId, dates] of datesByRoomId.entries()) {
    const item = itemsByRoomId.get(roomId)

    if (!item) {
      continue
    }

    const sortedDates = [...dates].sort()

    if (sortedDates.length === 0) {
      continue
    }

    let rangeStart = sortedDates[0]
    let previousDate = sortedDates[0]

    for (const currentDate of sortedDates.slice(1)) {
      if (currentDate === addOneDay(previousDate)) {
        previousDate = currentDate
        continue
      }

      result.push({
        ...serializeBookingRoom(item),
        checkIn: rangeStart,
        checkOut: addOneDay(previousDate),
      })

      rangeStart = currentDate
      previousDate = currentDate
    }

    result.push({
      ...serializeBookingRoom(item),
      checkIn: rangeStart,
      checkOut: addOneDay(previousDate),
    })
  }

  return result
}

function createMatrixBookingHref(
  selections: BookingRoomSelectionQueryItem[],
  composition: GuestComposition
) {
  const firstSelection = selections[0]

  if (!firstSelection) {
    return '/bookings/new'
  }

  const params = createBaseBookingParams(
    isoDateToInputValue(firstSelection.checkIn),
    isoDateToInputValue(firstSelection.checkOut),
    composition
  )

  params.set('roomSelections', JSON.stringify(selections))

  return `/bookings/new?${params.toString()}`
}

function createDailyBookingHref(item: AvailabilityItem, dateValue: string, composition: GuestComposition) {
  const checkIn = isoDateToInputValue(dateValue)
  const checkOut = isoDateToInputValue(addOneDay(dateValue))

  return createBookingHref(item, checkIn, checkOut, composition)
}

function createOccupiedArrivalHref(item: AvailabilityItem, dateValue: string) {
  const bookingId = item.occupied_booking_ids_by_date[dateValue]

  if (!bookingId) {
    return ''
  }

  return `/bookings/arrivals/${bookingId}?date=${encodeURIComponent(dateValue)}`
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

function normalizeFilterValue(value: string) {
  return value.toLocaleLowerCase('uk-UA').trim()
}

function getBuildingSortOrder(value: string) {
  const matchedBuildingNumber = normalizeFilterValue(value).match(/\d+/)?.[0]
  return matchedBuildingNumber ? Number(matchedBuildingNumber) : Number.MAX_SAFE_INTEGER
}

function matchesBuildingFilters(item: AvailabilityItem, selectedBuildingFilters: BuildingFilterValue[]) {
  if (selectedBuildingFilters.includes('all')) {
    return true
  }

  const normalizedBuildingName = normalizeFilterValue(item.building_name)
  return selectedBuildingFilters.some(
    (selectedBuildingFilter) =>
      normalizedBuildingName.includes(`\u043a\u043e\u0440\u043f\u0443\u0441 ${selectedBuildingFilter}`) || normalizedBuildingName.includes(selectedBuildingFilter)
  )
}

function matchesRoomTypeFilters(item: AvailabilityItem, selectedRoomTypeFilters: RoomTypeFilterValue[]) {
  if (selectedRoomTypeFilters.includes('all')) {
    return true
  }

  const normalizedRoomTypeName = normalizeFilterValue(item.room_type_name)

  return selectedRoomTypeFilters.some((selectedRoomTypeFilter) => {
    if (selectedRoomTypeFilter === 'semi_lux') {
      return normalizedRoomTypeName.includes('\u043d\u0430\u043f\u0456\u0432')
    }

    if (selectedRoomTypeFilter === 'lux') {
      return normalizedRoomTypeName.includes('\u043b\u044e\u043a\u0441') && !normalizedRoomTypeName.includes('\u043d\u0430\u043f\u0456\u0432')
    }

    return normalizedRoomTypeName.includes('\u0441\u0442\u0430\u043d\u0434')
  })
}

function toggleFilterValues<TValue extends string>(currentValues: TValue[], nextValue: TValue, allValue: TValue) {
  if (nextValue === allValue) {
    return [allValue]
  }

  const valuesWithoutAll = currentValues.filter((value) => value !== allValue)
  const nextValues = valuesWithoutAll.includes(nextValue)
    ? valuesWithoutAll.filter((value) => value !== nextValue)
    : [...valuesWithoutAll, nextValue]

  return nextValues.length > 0 ? nextValues : [allValue]
}

function FilterToggleGroup<TValue extends string>({
  legend,
  selectedValues,
  options,
  onToggle,
}: {
  legend: string
  selectedValues: TValue[]
  options: Array<{ value: TValue; label: string }>
  onToggle: (nextValue: TValue) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[12px] font-semibold text-[var(--crm-wine)] sm:text-sm">{legend}</legend>
      <div className="grid grid-cols-4 gap-2">
        {options.map((option) => {
          const isActive = selectedValues.includes(option.value)

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              aria-pressed={isActive}
              className={`inline-flex min-h-10 items-center justify-center rounded-2xl border px-1.5 py-2 text-[11px] font-semibold shadow-sm transition sm:text-xs ${
                isActive
                  ? 'border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] text-white'
                  : 'border-[var(--crm-wine-border)] bg-[var(--crm-panel)] text-neutral-900 hover:bg-[var(--crm-wine-soft-hover)]'
              }`}
            >
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function MultiDayAvailabilityMatrix({
  items,
  selectedDates,
  createCellHref,
  isMultiSelectEnabled,
  isMultiDateSelectEnabled,
  selectedCellKeys,
  onToggleRoomAtDate,
}: {
  items: AvailabilityItem[]
  selectedDates: string[]
  createCellHref: (item: AvailabilityItem, dateValue: string) => string
  isMultiSelectEnabled: boolean
  isMultiDateSelectEnabled: boolean
  selectedCellKeys: string[]
  onToggleRoomAtDate: (roomId: string, dateValue: string) => void
}) {
  const columnTemplate = `minmax(132px, 132px) repeat(${selectedDates.length}, minmax(72px, 72px))`
  const selectedCellKeysSet = new Set(selectedCellKeys)
  const selectedRoomIdsSet = new Set(selectedCellKeys.map((key) => parseMatrixSelectionKey(key)?.roomId).filter(Boolean))

  return (
    <div className="min-w-0 space-y-3">
      <div className="crm-horizontal-scroll flex flex-nowrap items-center gap-2 text-[12px] sm:text-sm">
        <span className="whitespace-nowrap rounded-full bg-[var(--crm-vine-soft)] px-2.5 py-1.5 font-semibold text-[var(--crm-vine-dark)]">
          {'\u041a\u043b\u0456\u0442\u0438\u043d\u043a\u0430 \u0437\u0435\u043b\u0435\u043d\u0430 = \u0432\u0456\u043b\u044c\u043d\u043e'}
        </span>
        <span className="whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1.5 font-semibold text-neutral-600">
          {'\u0421\u0456\u0440\u0430 = \u0437\u0430\u0439\u043d\u044f\u0442\u043e'}
        </span>
      </div>

      <div className="text-xs font-medium text-neutral-500 sm:text-sm">{'\u041d\u0430 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0456 \u0442\u0430\u0431\u043b\u0438\u0446\u044e \u043c\u043e\u0436\u043d\u0430 \u0433\u043e\u0440\u0442\u0430\u0442\u0438 \u0432\u043b\u0456\u0432\u043e \u0442\u0430 \u0432\u043f\u0440\u0430\u0432\u043e.'}</div>

      <div className="-mx-2 w-auto max-w-none overflow-hidden rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] shadow-sm sm:mx-0 sm:w-full sm:max-w-full">
        <div className="crm-horizontal-scroll w-full max-w-full px-1 pb-2 sm:px-0 sm:pb-0">
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
                    const isSelectionEnabled = isMultiSelectEnabled || isMultiDateSelectEnabled
                    const isSelectedDate = selectedCellKeysSet.has(getMatrixSelectionKey(item.room_id, dateValue))
                    const cellClassName = `min-h-[78px] border-l border-[var(--crm-wine-border)] px-1.5 py-1.5 sm:min-h-[88px] sm:px-2 sm:py-2 ${
                      isFree ? 'bg-[var(--crm-vine-soft)]' : 'bg-neutral-100'
                    } ${isSelectedDate ? 'ring-2 ring-[var(--crm-wine)] ring-inset' : ''}`
                    const contentClassName = `flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-sm sm:h-9 sm:w-9 ${
                      isFree
                        ? 'bg-white text-[var(--crm-vine-dark)]'
                        : 'bg-neutral-200 text-neutral-400'
                    }`
                    if (!isFree) {
                      const occupiedArrivalHref = createOccupiedArrivalHref(item, dateValue)

                      if (occupiedArrivalHref) {
                        return (
                          <Link
                            key={`${item.room_id}-${dateValue}`}
                            href={occupiedArrivalHref}
                            className={`flex items-center justify-center rounded-none transition hover:brightness-[0.98] ${cellClassName}`}
                            style={{ touchAction: 'pan-x' }}
                            scroll={false}
                          >
                            <div className={contentClassName}>—</div>
                          </Link>
                        )
                      }

                      return (
                        <div key={`${item.room_id}-${dateValue}`} className={`flex items-center justify-center ${cellClassName}`}>
                          <div className={contentClassName}>—</div>
                        </div>
                      )
                    }

                    if (isSelectionEnabled) {
                      return (
                        <button
                          key={`${item.room_id}-${dateValue}`}
                          type="button"
                          onClick={() => onToggleRoomAtDate(item.room_id, dateValue)}
                          className={`flex w-full items-center justify-center rounded-none transition hover:brightness-[0.98] ${cellClassName}`}
                          style={{ touchAction: 'pan-x' }}
                        >
                          <div className={contentClassName}>•</div>
                        </button>
                      )
                    }

                    return (
                      <Link
                        key={`${item.room_id}-${dateValue}`}
                        href={createCellHref(item, dateValue)}
                        className={`flex items-center justify-center rounded-none transition hover:brightness-[0.98] ${cellClassName}`}
                        style={{ touchAction: 'pan-x' }}
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
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 min-[1180px]:grid-cols-4">
      {items.map((item) => {
        const isSelected = selectedRoomIds.includes(item.room_id)

        if (isMultiSelectEnabled) {
          return (
            <button
              key={item.room_id}
              type="button"
              onClick={() => onToggleRoom(item.room_id)}
              className={`w-full min-w-0 rounded-3xl border-2 bg-white/90 px-2.5 py-2.5 text-left shadow-[0_10px_24px_rgba(143,45,86,0.08)] transition hover:-translate-y-0.5 hover:bg-[var(--crm-panel)] hover:shadow-lg sm:px-3 sm:py-3 ${
                isSelected
                  ? 'border-[var(--crm-wine)] ring-2 ring-[var(--crm-wine)] ring-inset'
                  : 'border-[var(--crm-wine-border)] hover:border-[var(--crm-wine)]'
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold leading-tight lg:text-[15px]">Номер {item.room_number}</div>
                  <div className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-[11px]">{item.building_name}, {item.room_type_name}</div>
                </div>
                <span
                  className={`inline-flex self-start rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                    isSelected ? 'bg-[var(--crm-wine)] text-white' : 'bg-white text-[var(--crm-wine)]'
                  }`}
                >
                  {isSelected ? 'Обрано' : 'Обрати'}
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-1 text-[10px] text-neutral-700 sm:gap-1.5 sm:text-[11px]">
                <span className="inline-flex whitespace-nowrap rounded-full bg-white px-2 py-1 shadow-sm">{item.guests_count} гост.</span>
                <span className="inline-flex whitespace-nowrap rounded-full bg-white px-2 py-1 shadow-sm">доп. місць: {item.extra_beds_count + item.free_extra_beds_count}</span>
              </div>
            </button>
          )
        }

        return (
          <Link
            key={item.room_id}
            href={createHref(item)}
            className="block w-full min-w-0 rounded-3xl border-2 border-[var(--crm-wine-border)] bg-white/90 px-2.5 py-2.5 shadow-[0_10px_24px_rgba(143,45,86,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--crm-wine)] hover:bg-[var(--crm-panel)] hover:shadow-lg sm:px-3 sm:py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold leading-tight lg:text-[15px]">Номер {item.room_number}</div>
                <div className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-[11px]">{item.building_name}, {item.room_type_name}</div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1 text-[10px] text-neutral-700 sm:gap-1.5 sm:text-[11px]">
              <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--crm-wine)] px-2 py-1 text-white shadow-sm">{item.guests_count} гост.</span>
              <span className="inline-flex whitespace-nowrap rounded-full bg-white px-2 py-1 shadow-sm">доп. місць: {item.extra_beds_count + item.free_extra_beds_count}</span>
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
  const resultsRef = useRef<HTMLElement | null>(null)

  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [adultsCount, setAdultsCount] = useState(2)
  const [childrenUnder6Count, setChildrenUnder6Count] = useState(0)
  const [children6PlusCount, setChildren6PlusCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AvailabilityItem[]>([])
  const [selectedBuildingFilters, setSelectedBuildingFilters] = useState<BuildingFilterValue[]>(['all'])
  const [selectedRoomTypeFilters, setSelectedRoomTypeFilters] = useState<RoomTypeFilterValue[]>(['all'])
  const [isMultiSelectEnabled, setIsMultiSelectEnabled] = useState(false)
  const [isMultiDateSelectEnabled, setIsMultiDateSelectEnabled] = useState(false)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [selectedCellKeys, setSelectedCellKeys] = useState<string[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false)

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
    setShouldScrollToResults(false)

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

        const buildingOrderDiff = getBuildingSortOrder(left.building_name) - getBuildingSortOrder(right.building_name)

        if (buildingOrderDiff !== 0) {
          return buildingOrderDiff
        }

        const roomNumberOrderDiff = Number(left.room_number) - Number(right.room_number)

        if (Number.isFinite(roomNumberOrderDiff) && roomNumberOrderDiff !== 0) {
          return roomNumberOrderDiff
        }

        const roomNumberLabelDiff = left.room_number.localeCompare(right.room_number, 'uk-UA', { numeric: true })

        if (roomNumberLabelDiff !== 0) {
          return roomNumberLabelDiff
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
      setSelectedCellKeys([])
      setShouldScrollToResults(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сталася помилка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!shouldScrollToResults || loading || error || !resultsRef.current) {
      return
    }

    resultsRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    setShouldScrollToResults(false)
  }, [shouldScrollToResults, loading, error])

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
  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesBuildingFilters(item, selectedBuildingFilters) &&
          matchesRoomTypeFilters(item, selectedRoomTypeFilters)
      ),
    [items, selectedBuildingFilters, selectedRoomTypeFilters]
  )
  const filteredRoomIdsSet = useMemo(() => new Set(filteredItems.map((item) => item.room_id)), [filteredItems])
  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedRoomIds.includes(item.room_id)),
    [filteredItems, selectedRoomIds]
  )
  const selectedRoomSelections = useMemo(
    () => buildRoomSelectionsFromMatrix(filteredItems, selectedCellKeys),
    [filteredItems, selectedCellKeys]
  )
  const showDailyBreakdown =
    Boolean(selectedCheckInIso) && Boolean(selectedCheckOutIso) && getNights(selectedCheckInIso, selectedCheckOutIso) > 1

  useEffect(() => {
    setSelectedRoomIds((current) => current.filter((roomId) => filteredRoomIdsSet.has(roomId)))
    setSelectedCellKeys((current) =>
      current.filter((key) => {
        const selection = parseMatrixSelectionKey(key)
        return selection ? filteredRoomIdsSet.has(selection.roomId) : false
      })
    )
  }, [filteredRoomIdsSet])

  function handleToggleMultiSelect(enabled: boolean) {
    setIsMultiSelectEnabled(enabled)
    setSelectedRoomIds([])
    setSelectedCellKeys([])
  }

  function handleToggleMultiDateSelect(enabled: boolean) {
    setIsMultiDateSelectEnabled(enabled)
    setSelectedCellKeys([])
  }

  function handleToggleRoom(roomId: string) {
    setSelectedRoomIds((current) => {
      const nextSelectedRoomIds = current.includes(roomId)
        ? current.filter((currentRoomId) => currentRoomId !== roomId)
        : [...current, roomId]

      return nextSelectedRoomIds
    })
  }

  function handleToggleRoomAtDate(roomId: string, dateValue: string) {
    const nextKey = getMatrixSelectionKey(roomId, dateValue)

    setSelectedCellKeys((current) => {
      const currentSelections = current.map((key) => parseMatrixSelectionKey(key)).filter((value): value is MatrixSelection => Boolean(value))

      if (isMultiSelectEnabled && isMultiDateSelectEnabled) {
        return current.includes(nextKey) ? current.filter((key) => key !== nextKey) : [...current, nextKey]
      }

      if (isMultiSelectEnabled) {
        const currentDateValue = currentSelections[0]?.dateValue

        if (!currentDateValue || currentDateValue !== dateValue) {
          return [nextKey]
        }

        return current.includes(nextKey) ? current.filter((key) => key !== nextKey) : [...current, nextKey]
      }

      if (isMultiDateSelectEnabled) {
        const currentRoomId = currentSelections[0]?.roomId

        if (!currentRoomId || currentRoomId !== roomId) {
          return [nextKey]
        }

        return current.includes(nextKey) ? current.filter((key) => key !== nextKey) : [...current, nextKey]
      }

      return current
    })
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-5 lg:px-5 lg:pt-5 lg:pb-6 xl:pb-8">
      <div className="mx-auto w-full max-w-[1280px] space-y-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
        <section className={`${sectionClass} lg:mx-0 lg:max-w-none lg:px-3 lg:py-3`}>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Доступність номерів</h1>
            <form onSubmit={handleSearch} className="mt-4 grid gap-3 lg:mt-3 lg:gap-2.5">
              <div className="space-y-3 lg:space-y-2.5">
                <div className="grid min-w-0 grid-cols-2 gap-3 lg:gap-2">
                  <label className="block min-w-0">
                    <span className="block text-center text-[13px] font-medium text-neutral-800 sm:text-sm">Дата заїзду</span>
                    <DatePickerField
                      value={checkIn}
                      onChange={(value) => {
                        setCheckIn(value)
                        setCheckOut(getNextDateInputValue(value))
                      }}
                      className={fieldClass}
                      required
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="block text-center text-[13px] font-medium text-neutral-800 sm:text-sm">Дата виїзду</span>
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

                <div className="grid grid-cols-2 gap-3 lg:gap-2">
                  <button type="button" onClick={() => void handleQuickPeriod(7)} disabled={loading} className={secondaryButtonClass}>
                    Тиждень
                  </button>
                  <button type="button" onClick={() => void handleQuickPeriod(30)} disabled={loading} className={secondaryButtonClass}>
                    Місяць
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-4 lg:px-3 lg:py-3">
                <div className="text-[13px] font-semibold text-[var(--crm-wine)] sm:text-sm">Склад гостей</div>
                <div className="mt-3 grid gap-3 min-[820px]:grid-cols-3 lg:mt-2 lg:grid-cols-1 lg:gap-2">
                  <CompositionField label="Гості" value={adultsCount} onChange={setAdultsCount} />
                  <CompositionField label="Додаткові гості" value={children6PlusCount} onChange={setChildren6PlusCount} />
                  <CompositionField label="До 6 років" value={childrenUnder6Count} onChange={setChildrenUnder6Count} />
                </div>
                <div className="mt-4 rounded-2xl bg-white px-3 py-3 text-[13px] leading-6 text-neutral-700 shadow-sm sm:text-sm lg:mt-3 lg:px-3 lg:py-2">
                  <div className="mt-1">Всього: {guestsCount}</div>
                </div>
              </div>

              <div>
                <button type="submit" disabled={loading} className={primaryButtonClass}>
                  {loading ? 'Перевірка...' : 'Перевірити доступність'}
                </button>
              </div>
            </form>
        </section>

        <section ref={resultsRef} className="min-w-0 space-y-3 lg:mx-0 lg:max-w-none">
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
              <div className={showDailyBreakdown ? sectionClass : `${sectionClass} mx-auto max-w-[920px]`}>
                <div className="space-y-4">
                  <div className="grid gap-3 xl:grid-cols-2">
                    <FilterToggleGroup
                      legend={'\u041a\u043e\u0440\u043f\u0443\u0441\u0438'}
                      selectedValues={selectedBuildingFilters}
                      options={buildingFilterOptions}
                      onToggle={(nextValue) => setSelectedBuildingFilters((current) => toggleFilterValues(current, nextValue, 'all'))}
                    />
                    <FilterToggleGroup
                      legend={'\u0422\u0438\u043f \u043d\u043e\u043c\u0435\u0440\u0430'}
                      selectedValues={selectedRoomTypeFilters}
                      options={roomTypeFilterOptions}
                      onToggle={(nextValue) => setSelectedRoomTypeFilters((current) => toggleFilterValues(current, nextValue, 'all'))}
                    />
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <label className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm">
                        <input
                          type="checkbox"
                          checked={isMultiSelectEnabled}
                          onChange={(e) => handleToggleMultiSelect(e.target.checked)}
                          className="h-5 w-5 rounded border-[var(--crm-wine-border)] text-[var(--crm-wine)] accent-[var(--crm-wine)]"
                        />
                        {'\u041e\u0431\u0440\u0430\u0442\u0438 \u043a\u0456\u043b\u044c\u043a\u0430 \u043d\u043e\u043c\u0435\u0440\u0456\u0432'}
                      </label>

                      {showDailyBreakdown ? (
                        <label className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--crm-wine-border)] bg-[var(--crm-panel)] px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm">
                          <input
                            type="checkbox"
                            checked={isMultiDateSelectEnabled}
                            onChange={(e) => handleToggleMultiDateSelect(e.target.checked)}
                            className="h-5 w-5 rounded border-[var(--crm-wine-border)] text-[var(--crm-wine)] accent-[var(--crm-wine)]"
                          />
                          {'\u041e\u0431\u0440\u0430\u0442\u0438 \u043a\u0456\u043b\u044c\u043a\u0430 \u0434\u0430\u0442'}
                        </label>
                      ) : null}
                    </div>

                    {showDailyBreakdown && (isMultiSelectEnabled || isMultiDateSelectEnabled) ? (
                      selectedRoomSelections.length > 0 ? (
                        <Link
                          href={createMatrixBookingHref(selectedRoomSelections, searchComposition)}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)]"
                        >
                          {`\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0437 ${selectedRoomSelections.length} \u0432\u0438\u0431\u043e\u0440\u043e\u043c(\u0438)`}
                        </Link>
                      ) : (
                        <div className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500">
                          {isMultiSelectEnabled && isMultiDateSelectEnabled
                            ? '\u041e\u0431\u0435\u0440\u0438 \u0437\u0435\u043b\u0435\u043d\u0456 \u043a\u043b\u0456\u0442\u0438\u043d\u043a\u0438 \u043d\u043e\u043c\u0435\u0440\u0456\u0432 \u0456 \u0434\u0430\u0442'
                            : isMultiSelectEnabled
                              ? '\u041e\u0431\u0435\u0440\u0438 \u043d\u043e\u043c\u0435\u0440\u0438 \u043d\u0430 \u043e\u0434\u043d\u0443 \u0434\u0430\u0442\u0443'
                              : '\u041e\u0431\u0435\u0440\u0438 \u0434\u0430\u0442\u0438 \u0434\u043b\u044f \u043e\u0434\u043d\u043e\u0433\u043e \u043d\u043e\u043c\u0435\u0440\u0430'}
                        </div>
                      )
                    ) : isMultiSelectEnabled ? (
                      selectedItems.length > 0 ? (
                        <Link
                          href={createMultiRoomBookingHref(
                            selectedItems,
                            checkIn,
                            checkOut,
                            searchComposition
                          )}
                          className="inline-flex min-h-11 items-center justify-center rounded-2xl border-2 border-[var(--crm-wine-dark)] bg-[var(--crm-wine)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(143,45,86,0.22)] transition hover:bg-[var(--crm-wine-dark)]"
                        >
                          {`\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0437 ${selectedItems.length} \u043d\u043e\u043c\u0435\u0440(\u0438)`}
                        </Link>
                      ) : (
                        <div className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500">
                          \u041e\u0431\u0435\u0440\u0438 \u043d\u043e\u043c\u0435\u0440\u0438
                        </div>
                      )
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  {filteredItems.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-600">
                      {'\u0417\u0430 \u0446\u0438\u043c\u0438 \u0444\u0456\u043b\u044c\u0442\u0440\u0430\u043c\u0438 \u043d\u043e\u043c\u0435\u0440\u0456\u0432 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e.'}
                    </div>
                  ) : showDailyBreakdown ? (
                    <MultiDayAvailabilityMatrix
                      items={filteredItems}
                      selectedDates={selectedDates}
                      createCellHref={(item, dateValue) => createDailyBookingHref(item, dateValue, searchComposition)}
                      isMultiSelectEnabled={isMultiSelectEnabled}
                      isMultiDateSelectEnabled={isMultiDateSelectEnabled}
                      selectedCellKeys={selectedCellKeys}
                      onToggleRoomAtDate={handleToggleRoomAtDate}
                    />
                  ) : (
                    <SingleDayAvailabilityGrid
                      items={filteredItems.filter((item) => item.is_fully_available)}
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
    </main>
  )
}


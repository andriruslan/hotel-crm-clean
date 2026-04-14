import { NextRequest, NextResponse } from 'next/server'
import { getPaidExtraBedsCount } from '@/lib/guest-composition'
import { getDatesInRange } from '@/lib/dates'
import { calculateBookingPrice } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type RoomRow = {
  id: string
  room_number: string
  building_name: string
  is_active: boolean
  room_types: RoomTypeRow[] | RoomTypeRow | null
}

type RoomTypeRow = {
  id: string
  name: string
  base_capacity: number
  max_capacity: number
  base_price_per_night: number
  extra_bed_price_per_night: number
}

type BookingRangeRow = {
  room_id: string
  check_in_date: string
  check_out_date: string
}

function getRoomType(value: RoomRow['room_types']) {
  if (!value) {
    return null
  }

  return Array.isArray(value) ? value[0] || null : value
}

export async function GET(request: NextRequest) {
  try {
    const checkIn = request.nextUrl.searchParams.get('checkIn') || ''
    const checkOut = request.nextUrl.searchParams.get('checkOut') || ''
    const guestsCountRaw = request.nextUrl.searchParams.get('guestsCount') || '1'
    const guestsCount = Number(guestsCountRaw)
    const adultsCount = Number(request.nextUrl.searchParams.get('adultsCount') || '0')
    const childrenUnder6Count = Number(request.nextUrl.searchParams.get('childrenUnder6Count') || '0')
    const children6PlusCount = Number(request.nextUrl.searchParams.get('children6PlusCount') || '0')

    if (!checkIn || !checkOut) {
      return NextResponse.json({ ok: false, error: 'Потрібно вказати дату заїзду і дату виїзду' }, { status: 400 })
    }

    if (!Number.isFinite(guestsCount) || guestsCount < 1) {
      return NextResponse.json({ ok: false, error: 'Некоректна кількість гостей' }, { status: 400 })
    }

    if (checkOut <= checkIn) {
      return NextResponse.json({ ok: false, error: 'Дата виїзду має бути пізніше за дату заїзду' }, { status: 400 })
    }

    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select(`
        id,
        room_number,
        building_name,
        is_active,
        room_types:room_type_id (
          id,
          name,
          base_capacity,
          max_capacity,
          base_price_per_night,
          extra_bed_price_per_night
        )
      `)
      .eq('is_active', true)

    if (roomsError) {
      return NextResponse.json({ ok: false, error: roomsError.message }, { status: 500 })
    }

    const { data: conflictingBookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('room_id, check_in_date, check_out_date')
      .neq('status', 'canceled')
      .lt('check_in_date', checkOut)
      .gt('check_out_date', checkIn)

    if (bookingsError) {
      return NextResponse.json({ ok: false, error: bookingsError.message }, { status: 500 })
    }

    const requestedDates = getDatesInRange(checkIn, checkOut)
    const bookingsByRoomId = new Map<string, BookingRangeRow[]>()

    for (const booking of (conflictingBookings || []) as BookingRangeRow[]) {
      const currentBookings = bookingsByRoomId.get(booking.room_id) || []
      currentBookings.push(booking)
      bookingsByRoomId.set(booking.room_id, currentBookings)
    }

    const availableItems = ((rooms || []) as RoomRow[])
      .map((room) => {
        const roomType = getRoomType(room.room_types)

        if (!roomType) {
          return null
        }

        if (guestsCount > Number(roomType.max_capacity)) {
          return null
        }

        const roomBookings = bookingsByRoomId.get(room.id) || []
        const freeDates = requestedDates.filter((requestedDate) =>
          roomBookings.every((booking) => !(booking.check_in_date <= requestedDate && booking.check_out_date > requestedDate))
        )
        const isFullyAvailable = freeDates.length === requestedDates.length
        const paidExtraBedsCount =
          Number.isFinite(adultsCount) && Number.isFinite(childrenUnder6Count) && Number.isFinite(children6PlusCount)
            ? getPaidExtraBedsCount(
                {
                  adultsCount: Math.max(0, adultsCount),
                  childrenUnder6Count: Math.max(0, childrenUnder6Count),
                  children6PlusCount: Math.max(0, children6PlusCount),
                },
                Number(roomType.base_capacity)
              )
            : undefined
        const pricing = calculateBookingPrice({
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestsCount,
          baseCapacity: Number(roomType.base_capacity),
          basePricePerNight: Number(roomType.base_price_per_night),
          extraBedPricePerNight: Number(roomType.extra_bed_price_per_night),
          paidExtraBedsCount,
        })

        return {
          room_id: room.id,
          room_number: room.room_number,
          building_name: room.building_name,
          room_type_name: roomType.name,
          base_capacity: Number(roomType.base_capacity),
          max_capacity: Number(roomType.max_capacity),
          base_price_per_night: Number(roomType.base_price_per_night),
          extra_bed_price_per_night: Number(roomType.extra_bed_price_per_night),
          guests_count: guestsCount,
          nights: pricing.nights,
          extra_beds_count: pricing.extraBedsCount,
          free_extra_beds_count: pricing.freeExtraBedsCount,
          price_base_total: pricing.priceBaseTotal,
          price_extra_total: pricing.priceExtraTotal,
          price_total: pricing.priceTotal,
          free_dates: freeDates,
          free_dates_count: freeDates.length,
          is_fully_available: isFullyAvailable,
        }
      })
      .filter((room): room is NonNullable<typeof room> => Boolean(room))
      .filter((room) => room.free_dates_count > 0)
      .sort((left, right) => {
        if (left.is_fully_available !== right.is_fully_available) {
          return left.is_fully_available ? -1 : 1
        }

        if (left.free_dates_count !== right.free_dates_count) {
          return right.free_dates_count - left.free_dates_count
        }

        return left.price_total - right.price_total
      })

    return NextResponse.json({ ok: true, items: availableItems })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

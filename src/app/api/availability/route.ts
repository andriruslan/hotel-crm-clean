import { NextRequest, NextResponse } from 'next/server'
import { calculateBookingPrice } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RoomRow = {
  id: string
  room_number: string
  building_name: string
  is_active: boolean
  room_types: {
    id: string
    name: string
    base_capacity: number
    max_capacity: number
    base_price_per_night: number
    extra_bed_price_per_night: number
  } | null
}

export async function GET(request: NextRequest) {
  try {
    const checkIn = request.nextUrl.searchParams.get('checkIn') || ''
    const checkOut = request.nextUrl.searchParams.get('checkOut') || ''
    const guestsCountRaw = request.nextUrl.searchParams.get('guestsCount') || '1'
    const guestsCount = Number(guestsCountRaw)

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
      .select('room_id')
      .neq('status', 'canceled')
      .lt('check_in_date', checkOut)
      .gt('check_out_date', checkIn)

    if (bookingsError) {
      return NextResponse.json({ ok: false, error: bookingsError.message }, { status: 500 })
    }

    const busyRoomIds = new Set((conflictingBookings || []).map((item) => item.room_id))

    const availableItems = ((rooms || []) as RoomRow[])
      .filter((room) => room.room_types)
      .filter((room) => !busyRoomIds.has(room.id))
      .filter((room) => guestsCount <= Number(room.room_types!.max_capacity))
      .map((room) => {
        const roomType = room.room_types!
        const pricing = calculateBookingPrice({
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestsCount,
          baseCapacity: Number(roomType.base_capacity),
          basePricePerNight: Number(roomType.base_price_per_night),
          extraBedPricePerNight: Number(roomType.extra_bed_price_per_night),
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
          price_base_total: pricing.priceBaseTotal,
          price_extra_total: pricing.priceExtraTotal,
          price_total: pricing.priceTotal,
        }
      })
      .sort((a, b) => a.price_total - b.price_total)

    return NextResponse.json({ ok: true, items: availableItems })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

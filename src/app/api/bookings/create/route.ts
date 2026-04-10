import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/phone'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RequestBody = {
  guest: {
    id?: string | null
    phone: string
    full_name: string
    birth_date: string
    guest_note?: string
  }
  booking: {
    room_id: string
    check_in_date: string
    check_out_date: string
    guests_count: number
    extra_beds_count: number
    booking_note?: string
    status: 'new' | 'confirmed' | 'canceled' | 'completed'
    payment_cash_amount: number
    payment_card_amount: number
    price_base_total: number
    price_extra_total: number
    price_total: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody

    const phone = normalizePhone(body.guest?.phone || '')
    const fullName = body.guest?.full_name?.trim() || ''
    const birthDate = body.guest?.birth_date || ''
    const guestNote = body.guest?.guest_note || ''

    if (!phone || !fullName || !birthDate) {
      return NextResponse.json(
        { ok: false, error: 'Телефон, ПІБ і дата народження є обов’язковими' },
        { status: 400 }
      )
    }

    const roomId = body.booking?.room_id || ''
    const checkInDate = body.booking?.check_in_date || ''
    const checkOutDate = body.booking?.check_out_date || ''

    if (!roomId || !checkInDate || !checkOutDate) {
      return NextResponse.json({ ok: false, error: 'Не вистачає даних бронювання' }, { status: 400 })
    }

    let guestId = body.guest?.id || null

    if (!guestId) {
      const { data: existingGuest, error: existingGuestError } = await supabaseAdmin
        .from('guests')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (existingGuestError) {
        return NextResponse.json({ ok: false, error: existingGuestError.message }, { status: 500 })
      }

      if (existingGuest?.id) {
        guestId = existingGuest.id

        const { error: updateGuestError } = await supabaseAdmin
          .from('guests')
          .update({
            full_name: fullName,
            birth_date: birthDate,
            guest_note: guestNote,
          })
          .eq('id', guestId)

        if (updateGuestError) {
          return NextResponse.json({ ok: false, error: updateGuestError.message }, { status: 500 })
        }
      } else {
        const { data: newGuest, error: createGuestError } = await supabaseAdmin
          .from('guests')
          .insert({
            phone,
            full_name: fullName,
            birth_date: birthDate,
            guest_note: guestNote,
          })
          .select('id')
          .single()

        if (createGuestError) {
          return NextResponse.json({ ok: false, error: createGuestError.message }, { status: 500 })
        }

        guestId = newGuest.id
      }
    }

    const paymentCash = Number(body.booking.payment_cash_amount || 0)
    const paymentCard = Number(body.booking.payment_card_amount || 0)

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        guest_id: guestId,
        room_id: roomId,
        check_in_date: body.booking.check_in_date,
        check_out_date: body.booking.check_out_date,
        guests_count: Number(body.booking.guests_count || 1),
        extra_beds_count: Number(body.booking.extra_beds_count || 0),
        booking_note: body.booking.booking_note || '',
        status: body.booking.status || 'new',
        payment_cash_amount: paymentCash,
        payment_card_amount: paymentCard,
        price_base_total: Number(body.booking.price_base_total || 0),
        price_extra_total: Number(body.booking.price_extra_total || 0),
        price_total: Number(body.booking.price_total || 0),
      })
      .select('id')
      .single()

    if (bookingError) {
      return NextResponse.json({ ok: false, error: bookingError.message }, { status: 500 })
    }

    const paymentsPayload = []
    if (paymentCash > 0) {
      paymentsPayload.push({
        booking_id: booking.id,
        method: 'cash',
        amount: paymentCash,
        comment: 'Створення бронювання',
      })
    }

    if (paymentCard > 0) {
      paymentsPayload.push({
        booking_id: booking.id,
        method: 'card',
        amount: paymentCard,
        comment: 'Створення бронювання',
      })
    }

    if (paymentsPayload.length > 0) {
      const { error: paymentsError } = await supabaseAdmin.from('payments').insert(paymentsPayload)

      if (paymentsError) {
        return NextResponse.json({ ok: false, error: paymentsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, bookingId: booking.id, guestId })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

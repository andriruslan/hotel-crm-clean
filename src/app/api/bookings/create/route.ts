export { POST } from '../create-group/route'
/*

import { NextRequest, NextResponse } from 'next/server'
import {
  buildBookingNoteWithMeta,
  generateBookingGroupId,
  getDefaultPaymentDueStage,
  type PaymentDueStage,
} from '@/lib/booking-note-meta'
import { getPaymentStatus } from '@/lib/payment-status'
import { getPhoneSearchCandidates, normalizePhone } from '@/lib/phone'
import { supabaseAdmin } from '@/lib/supabase/admin'

const UNKNOWN_GUEST_NAME = 'Гість без ПІБ'
const UNKNOWN_GUEST_BIRTH_DATE = '1900-01-01'

type BookingInput = {
  room_id: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  extra_beds_count: number
  booking_note?: string
  payment_due_stage?: PaymentDueStage
  booking_group_id?: string
  status: 'new' | 'confirmed' | 'canceled' | 'completed'
  payment_cash_amount: number
  payment_card_amount: number
  price_base_total: number
  price_extra_total: number
  price_total: number
}

type RequestBody = {
  guest: {
    id?: string | null
    phone: string
    full_name?: string
    birth_date?: string
    guest_note?: string
  }
  booking?: BookingInput
  bookings?: BookingInput[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody

    const phone = normalizePhone(body.guest?.phone || '')
    const fullName = body.guest?.full_name?.trim() || ''
    const birthDate = body.guest?.birth_date || ''
    const guestNote = body.guest?.guest_note || ''

    if (!phone) {
      return NextResponse.json({ ok: false, error: 'Телефон є обов’язковим' }, { status: 400 })
    }

    const bookingInputs = body.bookings?.length ? body.bookings : body.booking ? [body.booking] : []

    if (bookingInputs.length === 0) {
      return NextResponse.json({ ok: false, error: 'Не вистачає даних бронювання' }, { status: 400 })
    }

    let guestId = body.guest?.id || null

    if (!guestId) {
      const { data: existingGuest, error: existingGuestError } = await supabaseAdmin
        .from('guests')
        .select('id')
        .in('phone', getPhoneSearchCandidates(phone))
        .maybeSingle()

      if (existingGuestError) {
        return NextResponse.json({ ok: false, error: existingGuestError.message }, { status: 500 })
      }

      if (existingGuest?.id) {
        guestId = existingGuest.id
        const guestUpdatePayload: Record<string, string> = {
          guest_note: guestNote,
        }

        if (fullName) {
          guestUpdatePayload.full_name = fullName
        }

        if (birthDate) {
          guestUpdatePayload.birth_date = birthDate
        }

        const { error: updateGuestError } = await supabaseAdmin
          .from('guests')
          .update(guestUpdatePayload)
          .eq('id', guestId)

        if (updateGuestError) {
          return NextResponse.json({ ok: false, error: updateGuestError.message }, { status: 500 })
        }
      } else {
        const guestInsertPayload: {
          phone: string
          guest_note: string
          full_name: string
          birth_date: string
        } = {
          phone,
          guest_note: guestNote,
          full_name: fullName || UNKNOWN_GUEST_NAME,
          birth_date: birthDate || UNKNOWN_GUEST_BIRTH_DATE,
        }

        const { data: newGuest, error: createGuestError } = await supabaseAdmin
          .from('guests')
          .insert(guestInsertPayload)
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
    const totalPaid = paymentCash + paymentCard
    const priceTotal = Number(body.booking.price_total || 0)
    const paymentStatus = getPaymentStatus(priceTotal, totalPaid)
    const bookingNote = buildBookingNoteWithMeta(body.booking.booking_note || '', {
      paymentDueStage,
      bookingGroupId,
    })

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        guest_id: guestId,
        room_id: roomId,
        check_in_date: body.booking.check_in_date,
        check_out_date: body.booking.check_out_date,
        guests_count: Number(body.booking.guests_count || 1),
        extra_beds_count: Number(body.booking.extra_beds_count || 0),
        booking_note: bookingNote,
        status: body.booking.status || 'new',
        payment_cash_amount: paymentCash,
        payment_card_amount: paymentCard,
        payment_total_received: totalPaid,
        payment_status: paymentStatus,
        price_base_total: Number(body.booking.price_base_total || 0),
        price_extra_total: Number(body.booking.price_extra_total || 0),
        price_total: priceTotal,
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
*/

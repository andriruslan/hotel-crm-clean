import { NextRequest, NextResponse } from 'next/server'
import {
  buildBookingNoteWithMeta,
  generateBookingGroupId,
  getDefaultPaymentDueStage,
  getDefaultReservationPaymentTermDays,
  type PaymentDueStage,
} from '@/lib/booking-note-meta'
import { addDays, getTodayDate } from '@/lib/dates'
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
  status: 'new' | 'confirmed' | 'canceled' | 'completed'
  payment_cash_amount: number
  payment_card_amount: number
  certificate_amount?: number
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
  bookings?: BookingInput[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody
    const bookingInputs = body.bookings || []
    const phone = normalizePhone(body.guest?.phone || '')
    const fullName = body.guest?.full_name?.trim() || ''
    const birthDate = body.guest?.birth_date || ''
    const guestNote = body.guest?.guest_note || ''

    if (!phone) {
      return NextResponse.json({ ok: false, error: 'Телефон є обовʼязковим' }, { status: 400 })
    }

    if (bookingInputs.length === 0) {
      return NextResponse.json({ ok: false, error: 'Не передано жодного номера для бронювання' }, { status: 400 })
    }

    const invalidBooking = bookingInputs.find(
      (booking) => !booking.room_id || !booking.check_in_date || !booking.check_out_date
    )

    if (invalidBooking) {
      return NextResponse.json({ ok: false, error: 'Не вистачає даних по одному з номерів' }, { status: 400 })
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
        const { data: newGuest, error: createGuestError } = await supabaseAdmin
          .from('guests')
          .insert({
            phone,
            guest_note: guestNote,
            full_name: fullName || UNKNOWN_GUEST_NAME,
            birth_date: birthDate || UNKNOWN_GUEST_BIRTH_DATE,
          })
          .select('id')
          .single()

        if (createGuestError) {
          return NextResponse.json({ ok: false, error: createGuestError.message }, { status: 500 })
        }

        guestId = newGuest.id
      }
    }

    const bookingGroupId = bookingInputs.length > 1 ? generateBookingGroupId() : ''
    const bookingIds: string[] = []
    const paymentsPayload = []

    for (const bookingInput of bookingInputs) {
      const paymentCash = Number(bookingInput.payment_cash_amount || 0)
      const paymentCard = Number(bookingInput.payment_card_amount || 0)
      const certificateAmount = Math.max(0, Number(bookingInput.certificate_amount || 0))
      const totalPaid = paymentCash + paymentCard + certificateAmount
      const priceTotal = Number(bookingInput.price_total || 0)
      const paymentStatus = getPaymentStatus(priceTotal, totalPaid)
      const paymentDueStage = bookingInput.payment_due_stage || getDefaultPaymentDueStage()
      const reserveUntilDate =
        paymentDueStage === 'before_check_in'
          ? addDays(getTodayDate(), getDefaultReservationPaymentTermDays())
          : ''
      const bookingNote = buildBookingNoteWithMeta(bookingInput.booking_note || '', {
        paymentDueStage,
        bookingGroupId,
        reserveUntilDate,
        certificateAmount,
      })

      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .insert({
          guest_id: guestId,
          room_id: bookingInput.room_id,
          check_in_date: bookingInput.check_in_date,
          check_out_date: bookingInput.check_out_date,
          guests_count: Number(bookingInput.guests_count || 1),
          extra_beds_count: Number(bookingInput.extra_beds_count || 0),
          booking_note: bookingNote,
          status: bookingInput.status || 'new',
          payment_cash_amount: paymentCash,
          payment_card_amount: paymentCard,
          payment_total_received: totalPaid,
          payment_status: paymentStatus,
          price_base_total: Number(bookingInput.price_base_total || 0),
          price_extra_total: Number(bookingInput.price_extra_total || 0),
          price_total: priceTotal,
        })
        .select('id')
        .single()

      if (bookingError) {
        return NextResponse.json({ ok: false, error: bookingError.message }, { status: 500 })
      }

      bookingIds.push(booking.id)

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
    }

    if (paymentsPayload.length > 0) {
      const { error: paymentsError } = await supabaseAdmin.from('payments').insert(paymentsPayload)

      if (paymentsError) {
        return NextResponse.json({ ok: false, error: paymentsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      bookingId: bookingIds[0],
      bookingIds,
      bookingGroupId,
      guestId,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

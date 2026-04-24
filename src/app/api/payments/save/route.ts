import { NextRequest, NextResponse } from 'next/server'
import { buildBookingNoteWithMeta, parseBookingNoteMeta, type PaymentDueStage } from '@/lib/booking-note-meta'
import { getPaymentStatus } from '@/lib/payment-status'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RequestBody = {
  bookingId?: string
  cashAmount?: number
  cardAmount?: number
  comment?: string
  paymentDueStage?: PaymentDueStage
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody
    const bookingId = body.bookingId || ''
    const cashAmount = Number(body.cashAmount || 0)
    const cardAmount = Number(body.cardAmount || 0)
    const comment = body.comment || 'Оплата бронювання'
    const paymentDueStage = body.paymentDueStage

    if (!bookingId) {
      return NextResponse.json({ ok: false, error: 'Не передано bookingId' }, { status: 400 })
    }

    if (cashAmount <= 0 && cardAmount <= 0 && !paymentDueStage) {
      return NextResponse.json({ ok: false, error: 'Немає даних для збереження' }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, price_total, payment_cash_amount, payment_card_amount, payment_total_received, booking_note, status')
      .eq('id', bookingId)
      .single()

    if (bookingError) {
      return NextResponse.json({ ok: false, error: bookingError.message }, { status: 500 })
    }

    const newCashAmount = Number(booking.payment_cash_amount || 0) + cashAmount
    const newCardAmount = Number(booking.payment_card_amount || 0) + cardAmount
    const bookingMeta = parseBookingNoteMeta(booking.booking_note)
    const existingTotalPaid = Number(
      booking.payment_total_received ??
        Number(booking.payment_cash_amount || 0) + Number(booking.payment_card_amount || 0) + Number(bookingMeta.certificateAmount || 0)
    )
    const totalPaid = existingTotalPaid + cashAmount + cardAmount
    const paymentStatus = getPaymentStatus(Number(booking.price_total || 0), totalPaid)
    const bookingNote = buildBookingNoteWithMeta(
      bookingMeta.visibleNote,
      {
        paymentDueStage: paymentDueStage || bookingMeta.paymentDueStage,
        bookingGroupId: bookingMeta.bookingGroupId,
        reserveUntilDate: bookingMeta.reserveUntilDate,
        lastReminderAt: bookingMeta.lastReminderAt,
        certificateAmount: bookingMeta.certificateAmount,
        degustationGuestsCount: bookingMeta.degustationGuestsCount,
        degustationAmount: bookingMeta.degustationAmount,
      }
    )
    const nextStatus = booking.status === 'new' && totalPaid > 0 ? 'confirmed' : booking.status

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_cash_amount: newCashAmount,
        payment_card_amount: newCardAmount,
        payment_total_received: totalPaid,
        payment_status: paymentStatus,
        status: nextStatus,
        booking_note: bookingNote,
      })
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }

    const paymentsPayload = []

    if (cashAmount > 0) {
      paymentsPayload.push({
        booking_id: bookingId,
        method: 'cash',
        amount: cashAmount,
        comment,
      })
    }

    if (cardAmount > 0) {
      paymentsPayload.push({
        booking_id: bookingId,
        method: 'card',
        amount: cardAmount,
        comment,
      })
    }

    if (paymentsPayload.length > 0) {
      const { error: paymentsError } = await supabaseAdmin.from('payments').insert(paymentsPayload)

      if (paymentsError) {
        return NextResponse.json({ ok: false, error: paymentsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      bookingId,
      paymentStatus,
      status: nextStatus,
      paymentDueStage: paymentDueStage || bookingMeta.paymentDueStage,
      paymentTotalReceived: totalPaid,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

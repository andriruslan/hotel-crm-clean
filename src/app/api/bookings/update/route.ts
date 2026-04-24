import { NextRequest, NextResponse } from 'next/server'
import { buildBookingNoteWithMeta, parseBookingNoteMeta, type PaymentDueStage } from '@/lib/booking-note-meta'
import { supabaseAdmin } from '@/lib/supabase/admin'

type BookingStatus = 'new' | 'confirmed' | 'canceled' | 'completed'
type OccupancyStatus = 'not_checked_in' | 'checked_in' | 'checked_out'

type RequestBody = {
  bookingId?: string
  occupancyStatus?: OccupancyStatus
  paymentDueStage?: PaymentDueStage
  bookingStatus?: BookingStatus
  markReminder?: boolean
  reserveUntilDate?: string | null
  bookingNote?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody
    const bookingId = body.bookingId || ''
    const occupancyStatus = body.occupancyStatus
    const paymentDueStage = body.paymentDueStage
    const bookingStatus = body.bookingStatus
    const markReminder = Boolean(body.markReminder)
    const reserveUntilDate = body.reserveUntilDate
    const bookingNote = typeof body.bookingNote === 'string' ? body.bookingNote : undefined

    if (!bookingId) {
      return NextResponse.json({ ok: false, error: 'Не передано bookingId' }, { status: 400 })
    }

    const shouldLoadBookingMeta = Boolean(
      paymentDueStage || markReminder || reserveUntilDate !== undefined || bookingNote !== undefined
    )
    let bookingMeta = null as ReturnType<typeof parseBookingNoteMeta> | null

    if (shouldLoadBookingMeta) {
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('booking_note')
        .eq('id', bookingId)
        .single()

      if (bookingError) {
        return NextResponse.json({ ok: false, error: bookingError.message }, { status: 500 })
      }

      bookingMeta = parseBookingNoteMeta(booking.booking_note)
    }

    const updatePayload: {
      occupancy_status?: OccupancyStatus
      status?: BookingStatus
      booking_note?: string
    } = {}

    if (occupancyStatus) {
      updatePayload.occupancy_status = occupancyStatus
    }

    if (bookingStatus) {
      updatePayload.status = bookingStatus
    } else if (occupancyStatus === 'checked_out') {
      updatePayload.status = 'completed'
    }

    if (bookingMeta) {
      updatePayload.booking_note = buildBookingNoteWithMeta(bookingNote ?? bookingMeta.visibleNote, {
        paymentDueStage: paymentDueStage || bookingMeta.paymentDueStage,
        bookingGroupId: bookingMeta.bookingGroupId,
        reserveUntilDate: reserveUntilDate === undefined ? bookingMeta.reserveUntilDate : reserveUntilDate || '',
        lastReminderAt: markReminder ? new Date().toISOString() : bookingMeta.lastReminderAt,
        certificateAmount: bookingMeta.certificateAmount,
        degustationGuestsCount: bookingMeta.degustationGuestsCount,
        degustationAmount: bookingMeta.degustationAmount,
      })
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: 'Немає даних для оновлення' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('id, occupancy_status, status, booking_note')
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const nextMeta = parseBookingNoteMeta(data.booking_note)

    return NextResponse.json({
      ok: true,
      bookingId: data.id,
      occupancyStatus: data.occupancy_status,
      bookingStatus: data.status,
      bookingNote: nextMeta.visibleNote,
      rawBookingNote: data.booking_note,
      paymentDueStage: nextMeta.paymentDueStage,
      reserveUntilDate: nextMeta.reserveUntilDate,
      lastReminderAt: nextMeta.lastReminderAt,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

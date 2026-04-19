import { NextRequest, NextResponse } from 'next/server'
import { getTodayDate } from '@/lib/dates'
import { parseBookingNoteMeta } from '@/lib/booking-note-meta'
import { getEffectivePaidAmount, getPaymentStatus } from '@/lib/payment-status'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type ArrivalRelationRow = {
  id: string
  full_name?: string | null
  phone?: string | null
  room_number?: string | null
  building_name?: string | null
}

type ArrivalRelationValue = ArrivalRelationRow[] | ArrivalRelationRow | null

type ArrivalRow = {
  id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  booking_note: string | null
  price_total: number | null
  payment_cash_amount: number | null
  payment_card_amount: number | null
  payment_total_received: number | null
  payment_status: 'unpaid' | 'partial' | 'paid' | null
  status: 'new' | 'confirmed' | 'canceled' | 'completed'
  occupancy_status: 'not_checked_in' | 'checked_in' | 'checked_out'
  guest: ArrivalRelationValue
  room: ArrivalRelationValue
}

function getRelationRecord(value: ArrivalRelationValue): ArrivalRelationRow | null {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || getTodayDate()

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        room_id,
        check_in_date,
        check_out_date,
        guests_count,
        booking_note,
        price_total,
        payment_cash_amount,
        payment_card_amount,
        payment_total_received,
        payment_status,
        status,
        occupancy_status,
        guest:guest_id (
          id,
          full_name,
          phone
        ),
        room:room_id (
          id,
          room_number,
          building_name
        )
      `)
      .eq('check_in_date', date)
      .neq('status', 'canceled')
      .order('occupancy_status', { ascending: true })
      .order('room_id', { ascending: true })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = ((data || []) as ArrivalRow[]).map((item) => {
      const bookingMeta = parseBookingNoteMeta(item.booking_note)
      const guest = getRelationRecord(item.guest)
      const room = getRelationRecord(item.room)
      const priceTotal = Number(item.price_total || 0)
      const paymentCashAmount = Number(item.payment_cash_amount || 0)
      const paymentCardAmount = Number(item.payment_card_amount || 0)
      const paymentTotalReceived = getEffectivePaidAmount({
        paymentTotalReceived: item.payment_total_received,
        paymentCashAmount,
        paymentCardAmount,
        certificateAmount: bookingMeta.certificateAmount,
      })
      const paymentStatus = item.payment_status || getPaymentStatus(priceTotal, paymentTotalReceived)

      return {
        id: item.id,
        room_id: item.room_id,
        room_number: room?.room_number || '—',
        building_name: room?.building_name || '',
        guest_id: guest?.id || '',
        guest_name: guest?.full_name || '',
        guest_phone: guest?.phone || '',
        check_in_date: item.check_in_date,
        check_out_date: item.check_out_date,
        guests_count: item.guests_count,
        booking_note: bookingMeta.visibleNote,
        booking_group_id: bookingMeta.bookingGroupId,
        payment_due_stage: bookingMeta.paymentDueStage,
        price_total: priceTotal,
        payment_cash_amount: paymentCashAmount,
        payment_card_amount: paymentCardAmount,
        payment_total_received: paymentTotalReceived,
        certificate_amount: Number(bookingMeta.certificateAmount || 0),
        payment_status: paymentStatus,
        status: item.status,
        occupancy_status: item.occupancy_status,
      }
    })

    return NextResponse.json({ ok: true, date, items })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

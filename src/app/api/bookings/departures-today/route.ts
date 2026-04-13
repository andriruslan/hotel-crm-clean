import { NextRequest, NextResponse } from 'next/server'
import { parseBookingNoteMeta } from '@/lib/booking-note-meta'
import { getPaymentStatus } from '@/lib/payment-status'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTodayDate } from '@/lib/dates'

type DepartureRow = {
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
  guest: {
    id: string
    full_name: string | null
    phone: string | null
  } | null
  room: {
    id: string
    room_number: string | null
    building_name: string | null
  } | null
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
      .eq('check_out_date', date)
      .neq('status', 'canceled')
      .in('occupancy_status', ['checked_in', 'checked_out'])
      .order('occupancy_status', { ascending: true })
      .order('room_id', { ascending: true })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = ((data || []) as DepartureRow[]).map((item) => {
      const bookingMeta = parseBookingNoteMeta(item.booking_note)
      const priceTotal = Number(item.price_total || 0)
      const paymentCashAmount = Number(item.payment_cash_amount || 0)
      const paymentCardAmount = Number(item.payment_card_amount || 0)
      const paymentTotalReceived = Number(item.payment_total_received ?? paymentCashAmount + paymentCardAmount)
      const paymentStatus = item.payment_status || getPaymentStatus(priceTotal, paymentTotalReceived)

      return {
        id: item.id,
        room_id: item.room_id,
        room_number: item.room?.room_number || '—',
        building_name: item.room?.building_name || '',
        guest_id: item.guest?.id || '',
        guest_name: item.guest?.full_name || '',
        guest_phone: item.guest?.phone || '',
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

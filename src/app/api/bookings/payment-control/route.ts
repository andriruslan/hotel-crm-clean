import { NextRequest, NextResponse } from 'next/server'
import {
  getDefaultReservationPaymentTermDays,
  parseBookingNoteMeta,
} from '@/lib/booking-note-meta'
import { addDays, getTodayDate } from '@/lib/dates'
import { getPaymentStatus } from '@/lib/payment-status'
import { normalizePhone } from '@/lib/phone'
import { supabaseAdmin } from '@/lib/supabase/admin'

type PaymentControlRow = {
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
  created_at: string | null
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

function matchesSearch(
  item: {
    guest_name: string
    guest_phone: string
    room_number: string
    booking_group_id: string
    visible_note: string
  },
  search: string
) {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  const digitsSearch = normalizedSearch.replace(/\D/g, '')
  const phoneValue = normalizePhone(item.guest_phone || '')
  const phoneDigits = phoneValue.replace(/\D/g, '')

  return (
    item.guest_name.toLowerCase().includes(normalizedSearch) ||
    phoneValue.toLowerCase().includes(normalizedSearch) ||
    item.room_number.toLowerCase().includes(normalizedSearch) ||
    item.booking_group_id.toLowerCase().includes(normalizedSearch) ||
    item.visible_note.toLowerCase().includes(normalizedSearch) ||
    (digitsSearch.length > 0 && phoneDigits.includes(digitsSearch))
  )
}

export async function GET(request: NextRequest) {
  try {
    const today = getTodayDate()
    const search = request.nextUrl.searchParams.get('q') || ''

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
        created_at,
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
      .eq('occupancy_status', 'not_checked_in')
      .neq('status', 'canceled')
      .neq('status', 'completed')
      .gte('check_out_date', today)
      .order('check_in_date', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = ((data || []) as PaymentControlRow[])
      .map((item) => {
        const bookingMeta = parseBookingNoteMeta(item.booking_note)
        const priceTotal = Number(item.price_total || 0)
        const paymentCashAmount = Number(item.payment_cash_amount || 0)
        const paymentCardAmount = Number(item.payment_card_amount || 0)
        const paymentTotalReceived = Number(item.payment_total_received ?? paymentCashAmount + paymentCardAmount)
        const paymentStatus = item.payment_status || getPaymentStatus(priceTotal, paymentTotalReceived)
        const createdDate = item.created_at ? item.created_at.slice(0, 10) : today
        const reserveUntilDate =
          bookingMeta.reserveUntilDate ||
          (bookingMeta.paymentDueStage === 'before_check_in'
            ? addDays(createdDate, getDefaultReservationPaymentTermDays())
            : '')
        const isReserveExpired =
          bookingMeta.paymentDueStage === 'before_check_in' && paymentStatus !== 'paid' && Boolean(reserveUntilDate) && today > reserveUntilDate

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
          visible_note: bookingMeta.visibleNote,
          booking_group_id: bookingMeta.bookingGroupId,
          payment_due_stage: bookingMeta.paymentDueStage,
          reserve_until_date: reserveUntilDate,
          last_reminder_at: bookingMeta.lastReminderAt,
          created_at: item.created_at || '',
          price_total: priceTotal,
          payment_cash_amount: paymentCashAmount,
          payment_card_amount: paymentCardAmount,
          payment_total_received: paymentTotalReceived,
          payment_status: paymentStatus,
          payment_progress_percent: priceTotal > 0 ? Math.min(100, Math.round((paymentTotalReceived / priceTotal) * 100)) : 0,
          status: item.status,
          occupancy_status: item.occupancy_status,
          is_reserve_expired: isReserveExpired,
        }
      })
      .filter((item) => matchesSearch(item, search))
      .sort((left, right) => {
        if (left.is_reserve_expired !== right.is_reserve_expired) {
          return left.is_reserve_expired ? -1 : 1
        }

        if (left.payment_due_stage === 'before_check_in' && right.payment_due_stage !== 'before_check_in') {
          return -1
        }

        if (left.payment_due_stage !== 'before_check_in' && right.payment_due_stage === 'before_check_in') {
          return 1
        }

        if (left.reserve_until_date && right.reserve_until_date && left.reserve_until_date !== right.reserve_until_date) {
          return left.reserve_until_date.localeCompare(right.reserve_until_date)
        }

        if (left.check_in_date !== right.check_in_date) {
          return left.check_in_date.localeCompare(right.check_in_date)
        }

        return left.room_number.localeCompare(right.room_number, 'uk-UA')
      })

    return NextResponse.json({ ok: true, date: today, items })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}

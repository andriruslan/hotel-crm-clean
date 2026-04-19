import type { PaymentStatus } from '@/constants/payment-status'
import type { PaymentDueStage } from '@/lib/booking-note-meta'
import { getEffectivePaidAmount, getPaymentStatus } from '@/lib/payment-status'

export type ArrivalGroupItem = {
  id: string
  room_number: string
  building_name: string
  guest_name: string
  guest_phone: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  booking_note: string
  booking_group_id: string
  payment_due_stage: PaymentDueStage
  price_total: number
  payment_cash_amount: number
  payment_card_amount: number
  payment_total_received: number
  certificate_amount: number
  payment_status: PaymentStatus
  status: 'new' | 'confirmed' | 'canceled' | 'completed'
  occupancy_status: 'not_checked_in' | 'checked_in' | 'checked_out'
}

export type ArrivalGroup = {
  id: string
  booking_group_id: string
  guest_name: string
  guest_phone: string
  check_in_date: string
  check_out_date: string
  booking_note: string
  payment_due_stage: PaymentDueStage
  payment_status: PaymentStatus
  occupancy_status: 'not_checked_in' | 'checked_in'
  room_numbers: string[]
  total_guests_count: number
  total_price: number
  total_cash_amount: number
  total_card_amount: number
  total_paid: number
  total_balance: number
  items: ArrivalGroupItem[]
}

export function groupArrivalItems(items: ArrivalGroupItem[]) {
  const groups = new Map<string, ArrivalGroup>()

  for (const item of items) {
    const groupId = item.booking_group_id || item.id
    const currentGroup = groups.get(groupId)

    if (!currentGroup) {
      const totalPaid = getEffectivePaidAmount({
        paymentTotalReceived: item.payment_total_received,
        paymentCashAmount: item.payment_cash_amount,
        paymentCardAmount: item.payment_card_amount,
        certificateAmount: item.certificate_amount,
      })
      const totalPrice = Number(item.price_total || 0)

      groups.set(groupId, {
        id: groupId,
        booking_group_id: item.booking_group_id,
        guest_name: item.guest_name,
        guest_phone: item.guest_phone,
        check_in_date: item.check_in_date,
        check_out_date: item.check_out_date,
        booking_note: item.booking_note,
        payment_due_stage: item.payment_due_stage,
        payment_status: item.payment_status,
        occupancy_status: item.occupancy_status === 'checked_in' ? 'checked_in' : 'not_checked_in',
        room_numbers: [item.room_number],
        total_guests_count: Number(item.guests_count || 0),
        total_price: totalPrice,
        total_cash_amount: Number(item.payment_cash_amount || 0),
        total_card_amount: Number(item.payment_card_amount || 0),
        total_paid: totalPaid,
        total_balance: Math.max(0, totalPrice - totalPaid),
        items: [item],
      })
      continue
    }

    currentGroup.items.push(item)

    if (!currentGroup.room_numbers.includes(item.room_number)) {
      currentGroup.room_numbers.push(item.room_number)
    }

    currentGroup.total_guests_count += Number(item.guests_count || 0)
    currentGroup.total_price += Number(item.price_total || 0)
    currentGroup.total_cash_amount += Number(item.payment_cash_amount || 0)
    currentGroup.total_card_amount += Number(item.payment_card_amount || 0)
    currentGroup.total_paid += getEffectivePaidAmount({
      paymentTotalReceived: item.payment_total_received,
      paymentCashAmount: item.payment_cash_amount,
      paymentCardAmount: item.payment_card_amount,
      certificateAmount: item.certificate_amount,
    })
    currentGroup.total_balance = Math.max(0, currentGroup.total_price - currentGroup.total_paid)
    currentGroup.payment_status = getPaymentStatus(currentGroup.total_price, currentGroup.total_paid)
    currentGroup.occupancy_status = currentGroup.items.every((groupItem) => groupItem.occupancy_status === 'checked_in')
      ? 'checked_in'
      : 'not_checked_in'

    if (!currentGroup.booking_note && item.booking_note) {
      currentGroup.booking_note = item.booking_note
    }
  }

  return Array.from(groups.values())
}

export function allocateGroupPayment(
  items: ArrivalGroupItem[],
  cashAmount: number,
  cardAmount: number
) {
  let remainingCash = cashAmount
  let remainingCard = cardAmount

  return items
    .map((item) => ({
      item,
      balance: Math.max(
        0,
        Number(item.price_total || 0) -
          getEffectivePaidAmount({
            paymentTotalReceived: item.payment_total_received,
            paymentCashAmount: item.payment_cash_amount,
            paymentCardAmount: item.payment_card_amount,
            certificateAmount: item.certificate_amount,
          })
      ),
    }))
    .filter((entry) => entry.balance > 0)
    .map((entry) => {
      const cashPart = Math.min(entry.balance, remainingCash)
      remainingCash -= cashPart

      const remainingBalanceAfterCash = Math.max(0, entry.balance - cashPart)
      const cardPart = Math.min(remainingBalanceAfterCash, remainingCard)
      remainingCard -= cardPart

      return {
        bookingId: entry.item.id,
        cashAmount: cashPart,
        cardAmount: cardPart,
      }
    })
    .filter((entry) => entry.cashAmount > 0 || entry.cardAmount > 0)
}

import type { BookingStatus } from '@/constants/booking-status'
import type { PaymentStatus } from '@/constants/payment-status'
import type { OccupancyStatus } from '@/constants/occupancy-status'

export type Booking = {
  id: string
  guest_id: string
  room_id: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  extra_beds_count: number
  booking_note: string
  status: BookingStatus
  occupancy_status: OccupancyStatus
  payment_status: PaymentStatus
  price_base_total: number
  price_extra_total: number
  price_total: number
  payment_cash_amount: number
  payment_card_amount: number
  payment_total_received: number
  created_at: string
  updated_at: string
}

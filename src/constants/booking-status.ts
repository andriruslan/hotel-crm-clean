export const BOOKING_STATUSES = [
  'new',
  'confirmed',
  'canceled',
  'completed',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

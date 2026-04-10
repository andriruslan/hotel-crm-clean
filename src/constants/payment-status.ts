export const PAYMENT_STATUSES = [
  'unpaid',
  'partial',
  'paid',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

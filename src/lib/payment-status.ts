import type { PaymentStatus } from '@/constants/payment-status'

export function getPaymentStatus(priceTotal: number, totalPaid: number): PaymentStatus {
  if (totalPaid <= 0) {
    return 'unpaid'
  }

  if (totalPaid < priceTotal) {
    return 'partial'
  }

  return 'paid'
}

export function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case 'unpaid':
      return 'Не оплачено'
    case 'partial':
      return 'Частково оплачено'
    case 'paid':
      return 'Оплачено'
    default:
      return 'Не оплачено'
  }
}

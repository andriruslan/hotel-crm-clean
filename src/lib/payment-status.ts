import type { PaymentStatus } from '@/constants/payment-status'

export function getEffectivePaidAmount({
  paymentTotalReceived,
  paymentCashAmount,
  paymentCardAmount,
  certificateAmount,
}: {
  paymentTotalReceived?: number | null
  paymentCashAmount?: number | null
  paymentCardAmount?: number | null
  certificateAmount?: number | null
}) {
  const directPayments = Number(paymentCashAmount || 0) + Number(paymentCardAmount || 0)
  const totalWithCertificate = directPayments + Number(certificateAmount || 0)
  return Math.max(Number(paymentTotalReceived || 0), totalWithCertificate)
}

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

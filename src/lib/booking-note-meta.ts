export const PAYMENT_DUE_STAGES = [
  'before_check_in',
  'at_check_in',
  'at_check_out',
] as const

export type PaymentDueStage = (typeof PAYMENT_DUE_STAGES)[number]

const DEFAULT_PAYMENT_DUE_STAGE: PaymentDueStage = 'at_check_in'
const DEFAULT_RESERVATION_PAYMENT_TERM_DAYS = 3
const PAYMENT_DUE_STAGE_TAG = /\[\[payment_due_stage:(before_check_in|at_check_in|at_check_out)\]\]/g
const BOOKING_GROUP_TAG = /\[\[booking_group_id:([A-Z0-9-]+)\]\]/g
const RESERVE_UNTIL_TAG = /\[\[reserve_until:(\d{4}-\d{2}-\d{2})\]\]/g
const LAST_REMINDER_AT_TAG = /\[\[last_reminder_at:([^\]]+)\]\]/g
const CERTIFICATE_AMOUNT_TAG = /\[\[certificate_amount:(\d+)\]\]/g

export function getDefaultPaymentDueStage(): PaymentDueStage {
  return DEFAULT_PAYMENT_DUE_STAGE
}

export function getDefaultReservationPaymentTermDays() {
  return DEFAULT_RESERVATION_PAYMENT_TERM_DAYS
}

export function generateBookingGroupId() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()

  return `GRP-${timestamp}-${randomPart}`
}

export function parseBookingNoteMeta(note: string | null | undefined) {
  const source = note || ''
  const dueStageMatch = source.match(PAYMENT_DUE_STAGE_TAG)
  const dueStage = dueStageMatch?.at(-1)?.match(/before_check_in|at_check_in|at_check_out/)?.[0] as PaymentDueStage | undefined
  const groupMatch = source.match(BOOKING_GROUP_TAG)
  const reserveUntilMatch = source.match(RESERVE_UNTIL_TAG)
  const lastReminderAtMatch = source.match(LAST_REMINDER_AT_TAG)
  const certificateAmountMatch = source.match(CERTIFICATE_AMOUNT_TAG)
  const certificateAmount = Number(certificateAmountMatch?.at(-1)?.match(/\d+/)?.[0] || 0)

  return {
    paymentDueStage: dueStage || DEFAULT_PAYMENT_DUE_STAGE,
    bookingGroupId: groupMatch?.at(-1)?.match(/[A-Z0-9-]+/)?.[0] || '',
    reserveUntilDate: reserveUntilMatch?.at(-1)?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '',
    lastReminderAt: lastReminderAtMatch?.at(-1)?.match(/[^\]]+/)?.[0] || '',
    certificateAmount,
    visibleNote: source
      .replace(PAYMENT_DUE_STAGE_TAG, '')
      .replace(BOOKING_GROUP_TAG, '')
      .replace(RESERVE_UNTIL_TAG, '')
      .replace(LAST_REMINDER_AT_TAG, '')
      .replace(CERTIFICATE_AMOUNT_TAG, '')
      .trim(),
  }
}

export function buildBookingNoteWithMeta(
  note: string,
  options: {
    paymentDueStage: PaymentDueStage
    bookingGroupId?: string
    reserveUntilDate?: string
    lastReminderAt?: string
    certificateAmount?: number
  }
) {
  const visibleNote = parseBookingNoteMeta(note).visibleNote
  const metaTags = [`[[payment_due_stage:${options.paymentDueStage}]]`]

  if (options.bookingGroupId) {
    metaTags.push(`[[booking_group_id:${options.bookingGroupId}]]`)
  }

  if (options.paymentDueStage === 'before_check_in' && options.reserveUntilDate) {
    metaTags.push(`[[reserve_until:${options.reserveUntilDate}]]`)
  }

  if (options.paymentDueStage === 'before_check_in' && options.lastReminderAt) {
    metaTags.push(`[[last_reminder_at:${options.lastReminderAt}]]`)
  }

  if (Number(options.certificateAmount || 0) > 0) {
    metaTags.push(`[[certificate_amount:${Math.max(0, Math.round(Number(options.certificateAmount || 0)))}]]`)
  }

  const metaBlock = metaTags.join('\n')

  return visibleNote ? `${visibleNote}\n${metaBlock}` : metaBlock
}

export function getPaymentDueStageLabel(stage: PaymentDueStage) {
  switch (stage) {
    case 'before_check_in':
      return 'До заселення'
    case 'at_check_in':
      return 'При заселенні'
    case 'at_check_out':
      return 'При виїзді'
    default:
      return 'При заселенні'
  }
}

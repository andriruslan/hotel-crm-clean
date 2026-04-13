import { getNights } from '@/lib/dates'

type PricingInput = {
  checkInDate: string
  checkOutDate: string
  guestsCount: number
  baseCapacity: number
  basePricePerNight: number
  extraBedPricePerNight: number
  paidExtraBedsCount?: number
}

export function calculateBookingPrice(input: PricingInput) {
  const nights = getNights(input.checkInDate, input.checkOutDate)
  const totalExtraBedsCount = Math.max(0, input.guestsCount - input.baseCapacity)
  const extraBedsCount = Math.max(
    0,
    Math.min(
      totalExtraBedsCount,
      input.paidExtraBedsCount ?? totalExtraBedsCount
    )
  )
  const freeExtraBedsCount = Math.max(0, totalExtraBedsCount - extraBedsCount)

  const priceBaseTotal = nights * input.basePricePerNight
  const priceExtraTotal = nights * extraBedsCount * input.extraBedPricePerNight
  const priceTotal = priceBaseTotal + priceExtraTotal

  return {
    nights,
    extraBedsCount,
    paidExtraBedsCount: extraBedsCount,
    freeExtraBedsCount,
    priceBaseTotal,
    priceExtraTotal,
    priceTotal,
  }
}

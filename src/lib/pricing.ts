import { getNights } from '@/lib/dates'

type PricingInput = {
  checkInDate: string
  checkOutDate: string
  guestsCount: number
  baseCapacity: number
  basePricePerNight: number
  extraBedPricePerNight: number
}

export function calculateBookingPrice(input: PricingInput) {
  const nights = getNights(input.checkInDate, input.checkOutDate)
  const extraBedsCount = Math.max(0, input.guestsCount - input.baseCapacity)

  const priceBaseTotal = nights * input.basePricePerNight
  const priceExtraTotal = nights * extraBedsCount * input.extraBedPricePerNight
  const priceTotal = priceBaseTotal + priceExtraTotal

  return {
    nights,
    extraBedsCount,
    priceBaseTotal,
    priceExtraTotal,
    priceTotal,
  }
}

export type GuestComposition = {
  adultsCount: number
  childrenUnder6Count: number
  children6PlusCount: number
}

export function getTotalGuestsCount(composition: GuestComposition) {
  return composition.adultsCount + composition.childrenUnder6Count + composition.children6PlusCount
}

export function getPaidExtraBedsCount(composition: GuestComposition, baseCapacity: number) {
  return Math.max(0, composition.adultsCount + composition.children6PlusCount - baseCapacity)
}

export function getFreeExtraBedsCount(composition: GuestComposition, baseCapacity: number) {
  const totalExtraGuests = Math.max(0, getTotalGuestsCount(composition) - baseCapacity)
  return Math.max(0, totalExtraGuests - getPaidExtraBedsCount(composition, baseCapacity))
}

export function buildGuestCompositionSummary(composition: GuestComposition) {
  const parts: string[] = []

  if (composition.adultsCount > 0) {
    parts.push(`${composition.adultsCount} доросл.`)
  }

  if (composition.childrenUnder6Count > 0) {
    parts.push(`${composition.childrenUnder6Count} дит. до 6`)
  }

  if (composition.children6PlusCount > 0) {
    parts.push(`${composition.children6PlusCount} дит. 6+`)
  }

  return parts.join(', ')
}

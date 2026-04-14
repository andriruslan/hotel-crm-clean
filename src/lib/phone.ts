const UA_COUNTRY_CODE = '380'
const UA_DISPLAY_PREFIX = '38'

export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

function normalizeUkrainianPhoneDigits(phone: string): string {
  const digits = getPhoneDigits(phone)

  if (!digits) {
    return ''
  }

  if (digits.startsWith(UA_DISPLAY_PREFIX)) {
    return digits.slice(0, 12)
  }

  if (digits.startsWith(UA_COUNTRY_CODE)) {
    return digits.slice(0, 12)
  }

  if (digits.startsWith('80')) {
    return `3${digits.slice(0, 11)}`
  }

  if (digits.startsWith('0')) {
    return `38${digits.slice(0, 10)}`
  }

  if (digits.length <= 10) {
    return `${UA_DISPLAY_PREFIX}${digits.slice(0, 10)}`
  }

  return digits.slice(0, 12)
}

function formatUkrainianPhoneWithPrefix(localDigits: string, includeTrailingSpace = false): string {
  const sanitizedLocalDigits = localDigits.replace(/\D/g, '').slice(0, 10)
  const areaCode = sanitizedLocalDigits.slice(0, 3)
  const partOne = sanitizedLocalDigits.slice(3, 6)
  const partTwo = sanitizedLocalDigits.slice(6, 8)
  const partThree = sanitizedLocalDigits.slice(8, 10)

  let formatted = '+38'

  if (sanitizedLocalDigits.length === 0) {
    return includeTrailingSpace ? `${formatted} ` : formatted
  }

  if (areaCode) {
    formatted += ` ${areaCode}`
  }

  if (partOne) {
    formatted += ` ${partOne}`
  }

  if (partTwo) {
    formatted += `-${partTwo}`
  }

  if (partThree) {
    formatted += `-${partThree}`
  }

  return formatted
}

export function normalizePhone(phone: string): string {
  const digits = normalizeUkrainianPhoneDigits(phone)

  if (!digits) {
    return ''
  }

  return formatUkrainianPhoneWithPrefix(digits.slice(2))
}

export function formatPhoneInput(phone: string): string {
  const digits = normalizeUkrainianPhoneDigits(phone)
  const localDigits = digits ? digits.slice(2) : ''

  return formatUkrainianPhoneWithPrefix(localDigits, true)
}

export function getPhoneSearchCandidates(phone: string): string[] {
  const digits = normalizeUkrainianPhoneDigits(phone)
  const formatted = normalizePhone(phone)

  return Array.from(
    new Set(
      [formatted, digits, `+${digits}`, phone.trim()].filter((item) => item.length > 0)
    )
  )
}

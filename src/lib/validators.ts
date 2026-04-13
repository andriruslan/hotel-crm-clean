export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^\d]/g, '')
  return (
    (cleaned.startsWith('380') && cleaned.length === 12) ||
    (cleaned.startsWith('0') && cleaned.length === 10) ||
    cleaned.length === 9
  )
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0
}

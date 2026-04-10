export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^\d]/g, '')
  return cleaned.length >= 10
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0
}

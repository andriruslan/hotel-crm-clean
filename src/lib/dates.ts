export function getNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}

export function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addOneDay(dateStr: string): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getNextDateInputValue(value: string): string {
  if (!isCompleteDateInput(value)) {
    return value
  }

  return isoDateToInputValue(addOneDay(dateInputToIso(value)))
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDatesInRange(checkIn: string, checkOut: string): string[] {
  const dates: string[] = []

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return dates
  }

  let currentDate = checkIn

  while (currentDate < checkOut) {
    dates.push(currentDate)
    currentDate = addDays(currentDate, 1)
  }

  return dates
}

export function isoDateToInputValue(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) {
    return value
  }

  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

export function dateInputToIso(value: string): string {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/)

  if (!match) {
    return ''
  }

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export function formatDateForDisplay(value: string): string {
  return isoDateToInputValue(value)
}

export function formatDateWithWeekday(value: string): string {
  if (!value) {
    return ''
  }

  const normalizedValue = /^\d{2}-\d{2}-\d{4}$/.test(value) ? dateInputToIso(value) : value
  const parsed = new Date(`${normalizedValue}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const weekday = new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(parsed)
  return `${isoDateToInputValue(normalizedValue)} · ${weekday}`
}

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

export function isCompleteDateInput(value: string): boolean {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return false
  }

  const isoDate = dateInputToIso(value)
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    Number.isFinite(year) &&
    Number.isFinite(month) &&
    Number.isFinite(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

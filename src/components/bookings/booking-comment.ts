const AUTO_GENERATED_NOTE_PREFIXES = ['Склад гостей:', 'Додаткові місця:']

export function getEditableBookingComment(note: string | null | undefined) {
  return (note || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !AUTO_GENERATED_NOTE_PREFIXES.some((prefix) => line.startsWith(prefix)))
    .join('\n')
    .trim()
}

export function normalizeBookingCommentInput(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

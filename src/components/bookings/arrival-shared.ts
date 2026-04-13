export function getVisibleGuestName(value: string | null | undefined) {
  const normalizedValue = (value || '').trim()
  return normalizedValue && normalizedValue !== 'Гість без ПІБ' ? normalizedValue : ''
}

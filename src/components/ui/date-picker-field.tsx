'use client'

import type { FocusEvent, MouseEvent } from 'react'
import { dateInputToIso, isoDateToInputValue } from '@/lib/dates'

type DatePickerFieldProps = {
  value: string
  onChange: (value: string) => void
  className: string
  required?: boolean
  disabled?: boolean
}

export function DatePickerField({ value, onChange, className, required, disabled }: DatePickerFieldProps) {
  function openPicker(event: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
      } catch {
        // Some browsers allow the picker only from specific user gestures.
      }
    }
  }

  return (
    <input
      type="date"
      value={dateInputToIso(value)}
      onChange={(event) => onChange(isoDateToInputValue(event.target.value))}
      onClick={openPicker}
      onFocus={openPicker}
      className={`block min-w-0 max-w-full ${className}`}
      style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
      required={required}
      disabled={disabled}
    />
  )
}

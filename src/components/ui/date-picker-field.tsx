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
  const normalizedClassName = className
    .replace(/\bmt-1\.5\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

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
    <div className="mt-1.5 w-full min-w-0 max-w-full overflow-hidden rounded-2xl">
      <input
        type="date"
        value={dateInputToIso(value)}
        onChange={(event) => onChange(isoDateToInputValue(event.target.value))}
        onClick={openPicker}
        onFocus={openPicker}
        className={`crm-date-input block min-w-0 max-w-full text-center ${normalizedClassName}`}
        style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
        required={required}
        disabled={disabled}
      />
    </div>
  )
}

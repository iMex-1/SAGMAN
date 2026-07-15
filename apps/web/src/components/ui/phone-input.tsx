'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { parsePhoneDisplay, normalizePhone } from '@/lib/phone'

interface PhoneInputProps {
  id?: string
  value?: string
  onChange?: (value: string) => void
  error?: string
  required?: boolean
  autoComplete?: string
  autoFocus?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function PhoneInput({
  id,
  value = '',
  onChange,
  error,
  required,
  autoComplete,
  autoFocus,
  placeholder,
  className,
  disabled,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayValue = parsePhoneDisplay(value)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9)
    if (onChange) {
      onChange(normalizePhone(raw))
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <span
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-medium text-foreground select-none',
            error && 'text-destructive',
          )}
        >
          +212
        </span>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={9}
          className={cn(
            'flex h-10 w-full max-w-md rounded-md border border-input bg-background pl-14 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
            className,
          )}
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

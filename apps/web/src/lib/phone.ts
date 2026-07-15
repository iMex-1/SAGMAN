export function normalizePhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('212')) return `+${digits}`
  if (digits.startsWith('0')) return `+212${digits.slice(1)}`
  return `+212${digits}`
}

export function parsePhoneDisplay(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('212')) return digits.slice(3)
  if (digits.startsWith('0')) return digits.slice(1)
  return digits
}

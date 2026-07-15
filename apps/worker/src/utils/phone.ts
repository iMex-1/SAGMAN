export function normalizePhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone;
  if (digits.startsWith('212')) return `+${digits}`;
  if (digits.startsWith('0')) return `+212${digits.slice(1)}`;
  return `+212${digits}`;
}

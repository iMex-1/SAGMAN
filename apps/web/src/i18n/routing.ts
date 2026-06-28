export const locales = ['fr', 'ar'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fr'
export const rtlLocales: Locale[] = ['ar']

export function isRTL(locale: Locale | string): boolean {
  return rtlLocales.includes(locale as Locale)
}

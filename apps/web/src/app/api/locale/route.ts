import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from '@/i18n/request'

export async function POST(request: NextRequest) {
  const { locale } = await request.json()
  const validLocale = (locales as readonly string[]).includes(locale) ? locale : defaultLocale

  const response = NextResponse.json({ locale: validLocale })
  response.cookies.set('NEXT_LOCALE', validLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })
  return response
}

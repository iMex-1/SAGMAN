'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Icon } from '@/components/ui/icon'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { useTranslations } from 'next-intl'

export default function PortalRegisterPage() {
  const t = useTranslations()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError(t('portal.register.fillAllFields'))
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const res = await api.post<{
        data: {
          accessToken: string
          client: { id: string; name: string; phone: string }
        }
      }>('/auth/portal/register', {
        name: name.trim(),
        phone,
        password,
      })

      authStorage.setTokens(res.data.accessToken)
      authStorage.setUser({
        id: res.data.client.id,
        name: res.data.client.name,
        phone: res.data.client.phone,
        type: 'client',
      })
      router.push('/portal/cars')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('portal.register.createFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <Link
          href="/portal"
          className="mb-6 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
        >
          <Icon name="arrow_back" size={16} />
          {t('portal.register.backToHome')}
        </Link>

        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Icon name="person_add" size={28} className="text-white" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary">{t('portal.register.title')}</h1>
            <p className="mt-1 text-body-md font-body-md text-on-surface-variant">
              {t('portal.register.subtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-primary">{t('portal.register.nameLabel')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('portal.register.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-primary">{t('portal.register.phoneLabel')}</Label>
              <PhoneInput
                id="phone"
                placeholder={t('portal.register.phonePlaceholder')}
                value={phone}
                onChange={setPhone}
                required
                autoComplete="tel"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-primary">{t('portal.register.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('portal.register.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="h-12"
              />
            </div>

            <Button type="submit" className="h-12 w-full text-base font-semibold bg-primary text-white rounded-lg px-xl py-md font-title-md text-title-md" isLoading={isLoading}>
              {isLoading ? t('portal.register.submitting') : t('portal.register.submit')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-on-surface-variant">
            {t('portal.register.hasAccount')}{' '}
            <Link href="/portal/login" className="font-medium text-primary hover:underline">
              {t('portal.register.login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

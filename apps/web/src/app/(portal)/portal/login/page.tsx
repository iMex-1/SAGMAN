'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Lock, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

// ─── Login page ───────────────────────────────────────────────────────────────

export default function PortalLoginPage() {
  const t = useTranslations()
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !password.trim()) {
      setError(t('portal.login.fillAllFields'))
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const res = await api.post<{
        data: { accessToken: string; client: { id: string; name: string; phone: string } }
      }>('/auth/portal/login', { phone, password })

      authStorage.setTokens(res.data.accessToken)
      authStorage.setUser({
        id: res.data.client.id,
        name: res.data.client.name,
        phone: res.data.client.phone,
        type: 'client',
      })
      router.push('/portal/cars')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('portal.login.invalidCredentials'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-8">
      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          href="/portal"
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('portal.login.backToHome')}
        </Link>

        <div className="rounded-2xl border bg-white p-8 shadow-card">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {t('portal.login.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('portal.login.passwordSubtitle')}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t('portal.login.phoneLabel')}</Label>
              <PhoneInput
                id="phone"
                placeholder={t('portal.login.phonePlaceholder')}
                value={phone}
                onChange={setPhone}
                required
                autoFocus
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t('portal.login.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('portal.login.passwordPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base font-semibold"
              isLoading={isLoading}
            >
              {isLoading ? t('portal.login.signingIn') : t('portal.login.signIn')}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t('portal.login.noAccount')}{' '}
            <Link href="/portal/register" className="font-medium text-primary hover:underline">
              {t('portal.login.signUp')}
            </Link>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('portal.login.termsNotice')}{' '}
          <span className="text-primary hover:underline cursor-pointer">
            {t('common.termsOfService')}
          </span>
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Lock, ArrowLeft } from 'lucide-react'

// ─── Login page ───────────────────────────────────────────────────────────────

export default function PortalLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const res = await api.post<{
        data: { accessToken: string; client: { id: string; name: string; phone: string } }
      }>('/auth/portal/login', { phone: phone.trim(), password })

      authStorage.setTokens(res.data.accessToken)
      authStorage.setUser({
        id: res.data.client.id,
        name: res.data.client.name,
        phone: res.data.client.phone,
        type: 'client',
      })
      router.push('/portal/cars')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Identifiants invalides')
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
          Retour à l&apos;accueil
        </Link>

        <div className="rounded-2xl border bg-white p-8 shadow-card">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Espace client
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connectez-vous à votre compte
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
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                  🇲🇦
                </span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+212 6XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoFocus
                  className="h-12 pl-10 text-base"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="Entrez votre mot de passe"
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
              {isLoading ? 'Connexion en cours…' : 'Se connecter'}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link href="/portal/register" className="font-medium text-primary hover:underline">
              S&apos;inscrire
            </Link>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          En vous connectant, vous acceptez nos{' '}
          <span className="text-primary hover:underline cursor-pointer">
            conditions d&apos;utilisation
          </span>
        </p>
      </div>
    </div>
  )
}

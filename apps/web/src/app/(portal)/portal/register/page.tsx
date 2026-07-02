'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { UserPlus, ArrowLeft } from 'lucide-react'

export default function PortalRegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs')
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
        phone: phone.trim(),
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
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le compte')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <Link
          href="/portal"
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <div className="rounded-2xl border bg-white p-8 shadow-card">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <UserPlus className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Création de compte</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inscrivez-vous avec votre téléphone et un mot de passe.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+212 6XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="Entrez votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="h-12"
              />
            </div>

            <Button type="submit" className="h-12 w-full text-base font-semibold" isLoading={isLoading}>
              {isLoading ? 'Inscription en cours…' : 'Créer mon compte'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Vous avez déjà un compte ?{' '}
            <Link href="/portal/login" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Phone, ArrowLeft, Shield } from 'lucide-react'

// ─── Segmented OTP input ──────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(index: number, char: string) {
    const digits = value.split('')
    digits[index] = char.replace(/\D/g, '').slice(-1)
    const newVal = digits.join('').padEnd(6, ' ').slice(0, 6).trimEnd()
    onChange(newVal)
    if (char && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (value[index]) {
        // Clear current cell
        const digits = value.split('')
        digits[index] = ''
        onChange(digits.join(''))
      } else if (index > 0) {
        // Move focus back
        inputsRef.current[index - 1]?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] && value[i] !== ' ' ? value[i] : ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          className="h-14 w-11 rounded-xl border-2 border-input bg-background text-center text-xl font-bold text-foreground transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none md:w-12"
        />
      ))}
    </div>
  )
}

// ─── Login page ───────────────────────────────────────────────────────────────

export default function PortalLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)

  // ── Step 1: request OTP ──────────────────────────────────────────────────

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setError('')
    setIsLoading(true)
    try {
      const res = await api.post<{ data: { message: string; _devOtp?: string } }>(
        '/auth/portal/request-otp',
        { phone: phone.trim() },
      )
      setDevOtp(res.data._devOtp ?? null)
      setStep('otp')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi du code")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: verify OTP ───────────────────────────────────────────────────

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.replace(/\s/g, '')
    if (code.length < 6) {
      setError('Veuillez entrer les 6 chiffres du code')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const res = await api.post<{
        data: { accessToken: string; client: { id: string; name: string; phone: string } }
      }>('/auth/portal/verify-otp', { phone: phone.trim(), otp: code })

      authStorage.setTokens(res.data.accessToken)
      authStorage.setUser({
        id: res.data.client.id,
        name: res.data.client.name,
        phone: res.data.client.phone,
        type: 'client',
      })
      router.push('/portal/cars')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code invalide ou expiré')
    } finally {
      setIsLoading(false)
    }
  }

  const otpComplete = otp.replace(/\s/g, '').length >= 6

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
              {step === 'phone' ? (
                <Phone className="h-7 w-7 text-primary" />
              ) : (
                <Shield className="h-7 w-7 text-primary" />
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {step === 'phone' ? 'Espace client' : 'Vérification'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 'phone'
                ? 'Entrez votre numéro de téléphone'
                : `Code envoyé au ${phone}`}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Dev OTP hint */}
          {devOtp && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <span className="font-medium">Mode développement : </span>
              Code ={' '}
              <span className="font-mono font-bold tracking-widest">{devOtp}</span>
            </div>
          )}

          {/* ── Phone step ──────────────────────────────────────────────── */}
          {step === 'phone' ? (
            <form onSubmit={requestOtp} className="space-y-5">
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
              <Button
                type="submit"
                className="h-12 w-full text-base font-semibold"
                isLoading={isLoading}
              >
                {isLoading ? 'Envoi en cours…' : 'Recevoir mon code'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Un code à 6 chiffres sera envoyé par SMS
              </p>
            </form>
          ) : (
            /* ── OTP step ───────────────────────────────────────────────── */
            <form onSubmit={verifyOtp} className="space-y-6">
              <div className="space-y-3">
                <Label className="block text-center text-sm">Code de vérification</Label>
                <OtpInput value={otp} onChange={setOtp} />
                <p className="text-center text-xs text-muted-foreground">
                  Code valide pendant{' '}
                  <span className="font-medium text-foreground">10 minutes</span>
                </p>
              </div>
              <Button
                type="submit"
                className="h-12 w-full text-base font-semibold"
                isLoading={isLoading}
                disabled={!otpComplete}
              >
                {isLoading ? 'Vérification…' : 'Confirmer'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setOtp('')
                  setError('')
                  setDevOtp(null)
                }}
                className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Changer de numéro
              </button>
            </form>
          )}
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

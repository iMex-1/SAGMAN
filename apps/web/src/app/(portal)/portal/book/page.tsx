'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2, Calendar, Car, MessageSquare, Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientCar {
  id: string
  matricule: string
  make: string
  model: string
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-sm space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">Demande envoyée !</h2>
        <p className="text-muted-foreground">
          Votre demande de rendez-vous a bien été reçue. Notre équipe vous contactera rapidement
          pour confirmer.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/portal/cars"
            className="rounded-xl bg-primary px-6 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            Voir mes véhicules
          </Link>
          <Link
            href="/portal"
            className="text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalBookPage() {
  const router = useRouter()

  // Form state
  const [cars,          setCars]          = useState<ClientCar[]>([])
  const [selectedCarId, setSelectedCarId] = useState('')
  const [newMatricule,  setNewMatricule]  = useState('')
  const [purpose,       setPurpose]       = useState('')
  const [date,          setDate]          = useState('')
  const [time,          setTime]          = useState('09:00')
  const [notes,         setNotes]         = useState('')

  // UI state
  const [isLoading,      setIsLoading]      = useState(false)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Minimum date = tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDateStr = tomorrow.toISOString().split('T')[0]!

  useEffect(() => {
    const token = authStorage.getAccessToken()
    setIsAuthenticated(!!token)

    if (token) {
      api
        .get<{ data: ClientCar[] }>('/portal/cars')
        .then(res => setCars(res.data))
        .catch(() => {
          // If car fetch fails, just show the manual input — non-critical
        })
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!purpose.trim()) return
    if (!date) { setError('Veuillez sélectionner une date'); return }

    setError('')
    setIsLoading(true)

    try {
      const requestedAt = new Date(`${date}T${time}:00`).toISOString()

      const body: Record<string, unknown> = {
        purpose:     purpose.trim(),
        requestedAt,
        notes:       notes.trim() || undefined,
      }

      if (selectedCarId) {
        body.carId = selectedCarId
      } else if (newMatricule.trim()) {
        body.carMatricule = newMatricule.trim().toUpperCase()
      }

      // Attach client info if logged in
      const user = authStorage.getUser()
      if (user && 'phone' in user) {
        body.clientPhone = user.phone
        body.clientName  = user.name
      }

      await api.post('/portal/appointments', body)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de l'envoi de la demande. Réessayez.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (success) return <SuccessScreen />

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Back */}
      <Link
        href="/portal"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l&apos;accueil
      </Link>

      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Prendre rendez-vous</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Remplissez le formulaire — nous vous confirmons rapidement
        </p>
      </div>

      {/* Auth notice */}
      {!isAuthenticated && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Vous n&apos;êtes pas connecté</p>
            <p className="mt-0.5 text-amber-700">
              <Link href="/portal/login" className="underline hover:no-underline">
                Connectez-vous
              </Link>{' '}
              pour associer ce rendez-vous à votre compte et suivre votre réparation.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Vehicle ──────────────────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Car className="h-4 w-4 text-primary" />
            Votre véhicule
          </div>

          {/* Known cars (authenticated) */}
          {cars.length > 0 && (
            <div className="space-y-2">
              <Label>Sélectionner un véhicule enregistré</Label>
              <div className="space-y-2">
                {cars.map(car => (
                  <label
                    key={car.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                      selectedCarId === car.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="car"
                      value={car.id}
                      checked={selectedCarId === car.id}
                      onChange={() => { setSelectedCarId(car.id); setNewMatricule('') }}
                      className="accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {car.make} {car.model}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{car.matricule}</p>
                    </div>
                  </label>
                ))}

                {/* Option: new vehicle */}
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                    !selectedCarId ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="car"
                    value=""
                    checked={!selectedCarId}
                    onChange={() => setSelectedCarId('')}
                    className="accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    Autre véhicule (nouveau matricule)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Manual matricule input */}
          {!selectedCarId && (
            <div className="space-y-1.5">
              <Label htmlFor="matricule">Matricule / Immatriculation</Label>
              <Input
                id="matricule"
                placeholder="Ex: 12345-A-1"
                value={newMatricule}
                onChange={e => setNewMatricule(e.target.value.toUpperCase())}
                className="h-11 font-mono uppercase"
              />
            </div>
          )}
        </section>

        {/* ── Date & time ───────────────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            Date &amp; heure souhaitées
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={minDateStr}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Heure</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
                min="08:00"
                max="17:30"
                step="1800"
                className="h-11"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Horaires disponibles : Lun–Sam, 08:00–17:30
          </p>
        </section>

        {/* ── Problem description ───────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            Description du problème
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purpose">
              Décrivez le problème{' '}
              <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="purpose"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              required
              rows={4}
              placeholder="Ex: Bruit au démarrage, voyant moteur allumé, freins qui grincent…"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes supplémentaires (optionnel)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Toute information utile pour le mécanicien…"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="h-12 w-full text-base font-bold shadow-md"
          isLoading={isLoading}
        >
          {isLoading ? 'Envoi en cours…' : 'Envoyer ma demande'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Vous recevrez une confirmation par SMS ou appel téléphonique.
        </p>
      </form>
    </div>
  )
}

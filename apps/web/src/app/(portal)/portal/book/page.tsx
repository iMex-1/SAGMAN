'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/ui/icon'
import { useTranslations } from 'next-intl'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientCar {
  id: string
  matricule: string
  make: string
  model: string
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen() {
  const t = useTranslations()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-sm space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-container">
            <Icon name="check_circle" size={40} className="text-on-success-container" />
          </div>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-primary">{t('portal.booking.successTitle')}</h2>
        <p className="text-body-md font-body-md text-on-surface-variant">
          {t('portal.booking.successDesc')}
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/portal/cars"
            className="bg-primary text-white rounded-lg px-xl py-md font-title-md text-title-md text-center"
          >
            {t('portal.booking.viewMyCars')}
          </Link>
          <Link
            href="/portal"
            className="text-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            {t('portal.booking.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalBookPage() {
  const t = useTranslations()
  const router = useRouter()

  // Form state
  const [cars,            setCars]            = useState<ClientCar[]>([])
  const [selectedCarId,   setSelectedCarId]   = useState('')
  const [newMatricule,    setNewMatricule]    = useState('')
  const [newCarMake,      setNewCarMake]      = useState('')
  const [newCarModel,     setNewCarModel]     = useState('')
  const [newCarYear,      setNewCarYear]      = useState('')
  const [newCarColor,     setNewCarColor]     = useState('')
  const [purpose,         setPurpose]         = useState('')
  const [date,            setDate]            = useState('')
  const [time,            setTime]            = useState('09:00')
  const [notes,           setNotes]           = useState('')
  const [carImageFile,    setCarImageFile]    = useState<File | null>(null)
  const [carImagePreview, setCarImagePreview] = useState<string | null>(null)

  // UI state
  const [isLoading,      setIsLoading]      = useState(false)
  const [isUploading,    setIsUploading]    = useState(false)
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
    if (!date) { setError(t('portal.booking.selectDateError')); return }

    setError('')
    setIsLoading(true)

    try {
      let carImageUrl: string | undefined
      if (carImageFile) {
        setIsUploading(true)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(carImageFile)
        })
        const uploadRes = await api.post<{ url: string }>(
          '/portal/upload-car-image',
          { image: base64, mimeType: carImageFile.type },
        )
        carImageUrl = uploadRes.url
        setIsUploading(false)
      }

      const requestedAt = new Date(`${date}T${time}:00`).toISOString()

      const body: Record<string, unknown> = {
        purpose:     purpose.trim(),
        requestedAt,
        notes:       notes.trim() || undefined,
        carImageUrl,
      }

      if (selectedCarId) {
        body.carId = selectedCarId
      } else if (newMatricule.trim()) {
        body.carMatricule = newMatricule.trim().toUpperCase()
        if (newCarMake.trim()) body.carMake = newCarMake.trim()
        if (newCarModel.trim()) body.carModel = newCarModel.trim()
        if (newCarYear.trim()) body.carYear = newCarYear.trim()
        if (newCarColor.trim()) body.carColor = newCarColor.trim()
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
        err instanceof ApiError ? err.message : t('portal.booking.sendError'),
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
        className="flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" size={16} />
        {t('portal.booking.backToHome')}
      </Link>

      {/* Page title */}
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">{t('portal.booking.title')}</h1>
        <p className="mt-1 text-body-md font-body-md text-on-surface-variant">
          {t('portal.booking.subtitle')}
        </p>
      </div>

      {/* Auth notice */}
      {!isAuthenticated && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-container p-4 text-sm">
          <Icon name="info" size={16} className="mt-0.5 shrink-0 text-on-warning-container" />
          <div>
            <p className="font-medium text-on-warning-container">{t('portal.booking.authNotLoggedIn')}</p>
            <p className="mt-0.5 text-on-warning-container/80">
              <Link href="/portal/login" className="underline hover:no-underline font-medium">
                {t('portal.booking.authLoginPrompt')}
              </Link>{' '}
              {t('portal.booking.authDescription')}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Vehicle ──────────────────────────────────────────────────── */}
        <section className="space-y-4 bg-white border border-outline-variant rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 font-title-md text-title-md text-primary">
            <Icon name="directions_car" size={16} />
            {t('portal.booking.yourVehicle')}
          </div>

          {/* Known cars (authenticated) */}
          {cars.length > 0 && (
            <div className="space-y-2">
              <Label className="text-primary">{t('portal.booking.selectRegistered')}</Label>
              <div className="space-y-2">
                {cars.map(car => (
                  <label
                    key={car.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                      selectedCarId === car.id
                        ? 'border-primary bg-primary-container/20'
                        : 'border-outline-variant hover:bg-surface-container-low'
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
                      <p className="text-sm font-medium text-primary">
                        {car.make} {car.model}
                      </p>
                      <p className="font-mono text-xs text-on-surface-variant">{car.matricule}</p>
                    </div>
                  </label>
                ))}

                {/* Option: new vehicle */}
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                    !selectedCarId ? 'border-primary bg-primary-container/20' : 'border-outline-variant hover:bg-surface-container-low'
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
                  <span className="text-sm text-on-surface-variant">
                    {t('portal.booking.otherVehicle')}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Manual car input */}
          {!selectedCarId && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="matricule" className="text-primary">{t('car.fields.matricule')}</Label>
                <Input
                  id="matricule"
                  placeholder={t('portal.booking.newMatricule')}
                  value={newMatricule}
                  onChange={e => setNewMatricule(e.target.value.toUpperCase())}
                  className="h-11 font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="carMake" className="text-primary">{t('portal.booking.make')}</Label>
                  <Input
                    id="carMake"
                    placeholder={t('portal.booking.makePlaceholder')}
                    value={newCarMake}
                    onChange={e => setNewCarMake(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="carModel" className="text-primary">{t('portal.booking.model')}</Label>
                  <Input
                    id="carModel"
                    placeholder={t('portal.booking.modelPlaceholder')}
                    value={newCarModel}
                    onChange={e => setNewCarModel(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="carYear" className="text-primary">{t('portal.booking.year')}</Label>
                  <Input
                    id="carYear"
                    placeholder={t('portal.booking.yearPlaceholder')}
                    value={newCarYear}
                    onChange={e => setNewCarYear(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="carColor" className="text-primary">{t('portal.booking.color')}</Label>
                  <Input
                    id="carColor"
                    placeholder={t('portal.booking.colorPlaceholder')}
                    value={newCarColor}
                    onChange={e => setNewCarColor(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Car image ──────────────────────────────────────────────────── */}
        <section className="space-y-4 bg-white border border-outline-variant rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 font-title-md text-title-md text-primary">
            <Icon name="image" size={16} />
            {t('portal.book.vehiclePhoto')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="carImage" className="text-primary">{t('portal.book.photoOptional')}</Label>
            <div className="flex items-center gap-3">
              {carImagePreview && (
                <img src={carImagePreview} alt={t('common.preview')} className="w-16 h-16 rounded-lg object-cover border" />
              )}
              <Input
                id="carImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setCarImageFile(file)
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => setCarImagePreview(reader.result as string)
                    reader.readAsDataURL(file)
                  } else {
                    setCarImagePreview(null)
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* ── Date & time ───────────────────────────────────────────────── */}
        <section className="space-y-4 bg-white border border-outline-variant rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 font-title-md text-title-md text-primary">
            <Icon name="calendar_month" size={16} />
            {t('portal.booking.dateTime')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-primary">{t('portal.booking.date')}</Label>
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
              <Label htmlFor="time" className="text-primary">{t('portal.booking.time')}</Label>
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
          <p className="text-label-sm font-label-sm text-on-surface-variant">
            {t('portal.booking.availableHours')}
          </p>
        </section>

        {/* ── Problem description ───────────────────────────────────────── */}
        <section className="space-y-4 bg-white border border-outline-variant rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 font-title-md text-title-md text-primary">
            <Icon name="chat" size={16} />
            {t('portal.booking.problemDescription')}
          </div>

          <div className="space-y-1.5 max-w-lg">
            <Label htmlFor="purpose" className="text-primary">
              {t('portal.booking.describeProblem')}{' '}
              <span className="text-error">*</span>
            </Label>
            <textarea
              id="purpose"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              required
              rows={2}
              placeholder={t('portal.booking.problemPlaceholder')}
              className="w-full resize-vertical rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md font-body-md transition-colors placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5 max-w-lg">
            <Label htmlFor="notes" className="text-primary">{t('portal.booking.extraNotes')}</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={1}
              placeholder={t('portal.booking.extraNotesPlaceholder')}
              className="w-full resize-vertical rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md font-body-md transition-colors placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-error/30 bg-error-container p-4 text-sm text-on-error-container">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="h-12 w-full text-base font-bold shadow-sm bg-primary text-white rounded-lg px-xl py-md font-title-md text-title-md"
          isLoading={isLoading}
        >
          {isUploading ? t('portal.book.uploading') : isLoading ? t('portal.booking.submitting') : t('portal.booking.submit')}
        </Button>

        <p className="text-center text-label-sm font-label-sm text-on-surface-variant">
          {t('portal.booking.confirmationNote')}
        </p>
      </form>
    </div>
  )
}

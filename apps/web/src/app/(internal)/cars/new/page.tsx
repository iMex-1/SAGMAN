'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api, ApiError } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'

interface FieldErrors {
  matricule?: string
  make?: string
  model?: string
  year?: string
  color?: string
  vin?: string
  mileage?: string
  notes?: string
}

interface CreateCarResponse {
  data: { id: string; matricule: string }
}

export default function NewCarPage() {
  const router = useRouter()
  const t = useTranslations()
  const { success, error: toastError } = useToast()

  const [form, setForm] = useState({
    matricule: '',
    make: '',
    model: '',
    year: '',
    color: '',
    vin: '',
    mileage: '',
    notes: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!form.matricule.trim()) errors.matricule = t('car.validation.plateRequired')
    if (!form.make.trim()) errors.make = t('car.validation.makeRequired')
    if (!form.model.trim()) errors.model = t('car.validation.modelRequired')
    if (form.year) {
      const y = Number(form.year)
      if (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) {
        errors.year = t('car.validation.invalidYear')
      }
    }
    if (form.mileage && isNaN(Number(form.mileage))) {
      errors.mileage = t('car.validation.invalidMileage')
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setIsLoading(true)
    try {
      const res = await api.post<CreateCarResponse>('/cars', {
        matricule: form.matricule.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year ? Number(form.year) : undefined,
        color: form.color.trim() || undefined,
        vin: form.vin.trim() || undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        notes: form.notes.trim() || undefined,
      })
      success(t('car.toasts.created'), t('car.toasts.createdDesc', { matricule: res.data.matricule }))
      router.push(`/cars/${res.data.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.details) {
          setFieldErrors(err.details as FieldErrors)
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError(t('car.toasts.error'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cars">
            <Icon name="arrow_back" size={16} />
            {t('car.backLink')}
          </Link>
        </Button>
      </div>

      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline-lg text-headline-lg">{t('car.newTitle')}</CardTitle>
          <CardDescription className="font-body-md text-body-md text-on-surface-variant">{t('car.newDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                {t('car.sections.identity')}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="matricule">
                  {t('car.fields.plate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="matricule"
                  placeholder={t('car.placeholders.plate')}
                  value={form.matricule}
                  onChange={(e) => setField('matricule', e.target.value.toUpperCase())}
                  error={fieldErrors.matricule}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="make">
                    {t('car.fields.make')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="make"
                    placeholder={t('car.placeholders.make')}
                    value={form.make}
                    onChange={(e) => setField('make', e.target.value)}
                    error={fieldErrors.make}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">
                    {t('car.fields.model')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model"
                    placeholder={t('car.placeholders.model')}
                    value={form.model}
                    onChange={(e) => setField('model', e.target.value)}
                    error={fieldErrors.model}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">{t('car.fields.year')}</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder={t('car.placeholders.year')}
                    value={form.year}
                    onChange={(e) => setField('year', e.target.value)}
                    error={fieldErrors.year}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color">{t('car.fields.color')}</Label>
                  <Input
                    id="color"
                    placeholder={t('car.placeholders.color')}
                    value={form.color}
                    onChange={(e) => setField('color', e.target.value)}
                    error={fieldErrors.color}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">{t('car.fields.vin')}</Label>
                  <Input
                    id="vin"
                    placeholder={t('car.placeholders.vin')}
                    value={form.vin}
                    onChange={(e) => setField('vin', e.target.value)}
                    error={fieldErrors.vin}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                {t('car.sections.reception')}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="mileage">{t('car.fields.mileage')}</Label>
                <Input
                  id="mileage"
                  type="number"
                  placeholder={t('car.placeholders.mileage')}
                  value={form.mileage}
                  onChange={(e) => setField('mileage', e.target.value)}
                  error={fieldErrors.mileage}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('car.fields.notes')}</Label>
                <textarea
                  id="notes"
                  placeholder={t('car.placeholders.notes')}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-outline-variant bg-surface-container px-lg py-sm text-sm text-on-surface-variant">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              <p>{t('car.create.clientNote')}</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isLoading} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md min-w-[140px]">
                {isLoading ? (
                  <>
                    <Icon name="sync" size={16} className="animate-spin" />
                    {t('car.create.submitting')}
                  </>
                ) : (
                  t('car.create.submit')
                )}
              </Button>
              <Button variant="outline" type="button" asChild className="border border-outline-variant text-on-surface-variant">
                <Link href="/cars">{t('common.cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { normalizePhone } from '@/lib/phone'
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
  clientName?: string
  clientPhone?: string
  carMatricule?: string
  purpose?: string
  requestedDate?: string
  requestedTime?: string
  notes?: string
}

interface CreateAppointmentResponse {
  data: { id: string }
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  const t = useTranslations()

  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    carMatricule: '',
    purpose: '',
    requestedDate: '',
    requestedTime: '09:00',
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
    if (!form.clientName.trim()) errors.clientName = t('appointment.validation.nameRequired')
    if (!form.clientPhone.trim()) errors.clientPhone = t('appointment.validation.phoneRequired')
    if (!form.purpose.trim()) errors.purpose = t('appointment.validation.purposeRequired')
    if (!form.requestedDate) errors.requestedDate = t('appointment.validation.dateRequired')
    if (!form.requestedTime) errors.requestedTime = t('appointment.validation.timeRequired')
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setIsLoading(true)
    try {
      const requestedAt = new Date(
        `${form.requestedDate}T${form.requestedTime}:00`,
      ).toISOString()

      const res = await api.post<CreateAppointmentResponse>('/appointments', {
        clientName: form.clientName.trim(),
        clientPhone: normalizePhone(form.clientPhone),
        carMatricule: form.carMatricule.trim().toUpperCase() || undefined,
        purpose: form.purpose.trim(),
        requestedAt,
        notes: form.notes.trim() || undefined,
      })

      success(t('appointment.toasts.created'))
      router.push(`/appointments/${res.data.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.details) {
          setFieldErrors(err.details as FieldErrors)
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError(t('appointment.errors.generic'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/appointments">
            <Icon name="arrow_back" size={16} />
            {t('appointment.backLink')}
          </Link>
        </Button>
      </div>

      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline-lg text-headline-lg">{t('appointment.newTitle')}</CardTitle>
          <CardDescription className="font-body-md text-body-md text-on-surface-variant">{t('appointment.newDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-outline-variant bg-surface-container px-lg py-sm text-sm text-on-surface-variant">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              <p>{t('appointment.managerConfirmNote')}</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                {t('appointment.sections.client')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">
                    {t('appointment.fields.clientName')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    placeholder={t('appointment.placeholders.clientName')}
                    value={form.clientName}
                    onChange={(e) => setField('clientName', e.target.value)}
                    error={fieldErrors.clientName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">
                    {t('appointment.fields.clientPhone')} <span className="text-destructive">*</span>
                  </Label>
                  <PhoneInput
                    id="clientPhone"
                    placeholder={t('appointment.placeholders.clientPhone')}
                    value={form.clientPhone}
                    onChange={(v) => setField('clientPhone', v)}
                    error={fieldErrors.clientPhone}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                {t('appointment.sections.vehicle')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="carMatricule">{t('appointment.fields.plate')}</Label>
                <Input
                  id="carMatricule"
                  placeholder={t('appointment.placeholders.plate')}
                  value={form.carMatricule}
                  onChange={(e) => setField('carMatricule', e.target.value.toUpperCase())}
                  error={fieldErrors.carMatricule}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                {t('appointment.sections.details')}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="purpose">
                  {t('appointment.fields.purpose')} <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="purpose"
                  placeholder={t('appointment.placeholders.purpose')}
                  value={form.purpose}
                  onChange={(e) => setField('purpose', e.target.value)}
                  rows={3}
                  className={`w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    fieldErrors.purpose ? 'border-destructive' : 'border-input'
                  }`}
                  required
                />
                {fieldErrors.purpose && (
                  <p className="text-xs text-destructive">{fieldErrors.purpose}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="requestedDate">
                    {t('appointment.fields.date')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requestedDate"
                    type="date"
                    value={form.requestedDate}
                    onChange={(e) => setField('requestedDate', e.target.value)}
                    error={fieldErrors.requestedDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requestedTime">
                    {t('appointment.fields.time')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requestedTime"
                    type="time"
                    value={form.requestedTime}
                    onChange={(e) => setField('requestedTime', e.target.value)}
                    error={fieldErrors.requestedTime}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('appointment.fields.notes')}</Label>
                <textarea
                  id="notes"
                  placeholder={t('appointment.placeholders.notes')}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isLoading} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md min-w-[160px]">
                {isLoading ? (
                  <>
                    <Icon name="sync" size={16} className="animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  t('common.create')
                )}
              </Button>
              <Button variant="outline" type="button" asChild className="border border-outline-variant text-on-surface-variant">
                <Link href="/appointments">{t('common.cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

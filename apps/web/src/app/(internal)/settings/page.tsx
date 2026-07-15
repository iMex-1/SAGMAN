'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Separator } from '@/components/ui/separator'
import { api, ApiError } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'
import { useTranslations } from 'next-intl'

// Keys match the API schema (snake_case)
interface GarageSettings {
  garage_name: string
  garage_address: string
  garage_phone: string
  max_concurrent_cars: number
  working_hours: string
  currency_label: string
  overseer_whatsapp_number: string
  whatsapp_number: string
  depannage_number: string
  facebook_url: string
  instagram_url: string
  tiktok_url: string
  require_diagnosis_approval: 'true' | 'false'
  require_client_approval: 'true' | 'false'
}

interface SettingsResponse {
  data: Record<string, string>
}

const DEFAULTS: GarageSettings = {
  garage_name: '',
  garage_address: '',
  garage_phone: '',
  max_concurrent_cars: 5,
  working_hours: 'Mon-Sat 08:00-18:00',
  currency_label: 'DH',
  overseer_whatsapp_number: '',
  whatsapp_number: '',
  depannage_number: '',
  facebook_url: '',
  instagram_url: '',
  tiktok_url: '',
  require_diagnosis_approval: 'true',
  require_client_approval: 'true',
}

function parseSettings(raw: Record<string, string>): GarageSettings {
  return {
    garage_name: raw.garage_name ?? DEFAULTS.garage_name,
    garage_address: raw.garage_address ?? DEFAULTS.garage_address,
    garage_phone: normalizePhone(raw.garage_phone ?? DEFAULTS.garage_phone),
    max_concurrent_cars: parseInt(raw.max_concurrent_cars ?? String(DEFAULTS.max_concurrent_cars), 10),
    working_hours: raw.working_hours ?? DEFAULTS.working_hours,
    currency_label: raw.currency_label ?? DEFAULTS.currency_label,
    overseer_whatsapp_number: normalizePhone(raw.overseer_whatsapp_number ?? DEFAULTS.overseer_whatsapp_number),
    whatsapp_number: normalizePhone(raw.whatsapp_number ?? DEFAULTS.whatsapp_number),
    depannage_number: normalizePhone(raw.depannage_number ?? DEFAULTS.depannage_number),
    facebook_url: raw.facebook_url ?? DEFAULTS.facebook_url,
    instagram_url: raw.instagram_url ?? DEFAULTS.instagram_url,
    tiktok_url: raw.tiktok_url ?? DEFAULTS.tiktok_url,
    require_diagnosis_approval: (raw.require_diagnosis_approval === 'false' ? 'false' : 'true') as 'true' | 'false',
    require_client_approval: (raw.require_client_approval === 'false' ? 'false' : 'true') as 'true' | 'false',
  }
}

export default function SettingsPage() {
  const t = useTranslations()
  const { success, error: toastError } = useToast()

  const [settings, setSettings] = useState<GarageSettings>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await api.get<SettingsResponse>('/settings')
      setSettings(parseSettings(res.data))
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : t('settings.errors.loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  function setField<K extends keyof GarageSettings>(key: K, value: GarageSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaveError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setIsSaving(true)

    try {
      // Send only fields the API schema recognises (snake_case)
      await api.patch('/settings', {
        garage_name: settings.garage_name || undefined,
        garage_address: settings.garage_address || undefined,
        garage_phone: normalizePhone(settings.garage_phone) || undefined,
        max_concurrent_cars: settings.max_concurrent_cars,
        working_hours: settings.working_hours || undefined,
        currency_label: settings.currency_label || undefined,
        overseer_whatsapp_number: normalizePhone(settings.overseer_whatsapp_number) || undefined,
        whatsapp_number: normalizePhone(settings.whatsapp_number) || undefined,
        depannage_number: normalizePhone(settings.depannage_number) || undefined,
        facebook_url: settings.facebook_url || undefined,
        instagram_url: settings.instagram_url || undefined,
        tiktok_url: settings.tiktok_url || undefined,
        require_diagnosis_approval: settings.require_diagnosis_approval,
        require_client_approval: settings.require_client_approval,
      })
      success(t('settings.saved'))
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message)
        toastError(t('settings.errors.saveFailed'), err.message)
      } else {
        setSaveError(t('common.unexpectedError'))
        toastError(t('settings.errors.saveFailed'), t('common.unexpectedError'))
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline-xl text-headline-xl">{t('settings.title')}</h1>
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
          <Icon name="error" size={20} className="shrink-0 text-primary" />
          <p className="font-body-md text-body-md text-primary">{loadError}</p>
          <Button variant="outline" size="sm" onClick={fetchSettings} className="ml-auto">
            {t('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">{t('settings.title')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {saveError && (
          <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3 font-body-md text-body-md text-primary">
            <Icon name="error" size={16} className="shrink-0" />
            {saveError}
          </div>
        )}

        {/* Garage Info */}
        <Card>
          <CardHeader>
            <CardTitle className="font-title-md text-title-md">{t('settings.sections.garage')}</CardTitle>
            <CardDescription className="font-body-md text-body-md text-on-surface-variant">{t('settings.sections.garage')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="garage_name" className="font-title-md text-title-md">{t('settings.fields.garageName')}</Label>
              <Input
                id="garage_name"
                placeholder={t('common.example') + ": Sagman Auto Repair"}
                value={settings.garage_name}
                onChange={(e) => setField('garage_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage_address" className="font-title-md text-title-md">{t('settings.fields.garageAddress')}</Label>
              <Input
                id="garage_address"
                placeholder={t('common.example') + ": 123 Rue des Ateliers, Alger"}
                value={settings.garage_address}
                onChange={(e) => setField('garage_address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage_phone" className="font-title-md text-title-md">{t('settings.fields.garagePhone')}</Label>
              <PhoneInput
                id="garage_phone"
                placeholder={t('common.example') + ": 6XX XXX XXX"}
                value={settings.garage_phone}
                onChange={(v) => setField('garage_phone', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Operational Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="font-title-md text-title-md">{t('settings.sections.operational')}</CardTitle>
            <CardDescription className="font-body-md text-body-md text-on-surface-variant">
              {t('settings.sections.operational')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_concurrent_cars" className="font-title-md text-title-md">{t('settings.fields.maxConcurrentCars')}</Label>
              <Input
                id="max_concurrent_cars"
                type="number"
                min={1}
                max={50}
                value={settings.max_concurrent_cars}
                onChange={(e) =>
                  setField('max_concurrent_cars', parseInt(e.target.value, 10) || 1)
                }
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.fields.maxConcurrentCars')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="working_hours" className="font-title-md text-title-md">{t('settings.fields.workingHours')}</Label>
              <Input
                id="working_hours"
                placeholder={t('common.example') + ": Lun-Sam 08:00-18:00"}
                value={settings.working_hours}
                onChange={(e) => setField('working_hours', e.target.value)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.fields.workingHours')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency_label" className="font-title-md text-title-md">{t('settings.fields.currencyLabel')}</Label>
              <Input
                id="currency_label"
                placeholder={t('common.example') + ": DH"}
                maxLength={10}
                value={settings.currency_label}
                onChange={(e) => setField('currency_label', e.target.value)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.fields.currencyLabel')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Client Portal Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="font-title-md text-title-md">{t('settings.sections.portal')}</CardTitle>
            <CardDescription className="font-body-md text-body-md text-on-surface-variant">
              {t('settings.sections.portal')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="overseer_whatsapp_number" className="font-title-md text-title-md">{t('settings.fields.overseerWhatsapp')}</Label>
              <PhoneInput
                id="overseer_whatsapp_number"
                placeholder={t('common.example') + ": 6XX XXX XXX"}
                value={settings.overseer_whatsapp_number}
                onChange={(v) => setField('overseer_whatsapp_number', v)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.fields.overseerWhatsapp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number" className="font-title-md text-title-md">{t('settings.fields.overseerWhatsapp')}</Label>
              <PhoneInput
                id="whatsapp_number"
                placeholder={t('common.example') + ": 6XX XXX XXX"}
                value={settings.whatsapp_number}
                onChange={(v) => setField('whatsapp_number', v)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.fields.overseerWhatsapp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="depannage_number" className="font-title-md text-title-md">{t('settings.fields.garagePhone')}</Label>
              <Input
                id="depannage_number"
                type="tel"
                placeholder={t('common.example') + ": +212 6 XX XX XX XX"}
                value={settings.depannage_number}
                onChange={(e) => setField('depannage_number', e.target.value)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.fields.garagePhone')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook_url" className="font-title-md text-title-md">URL Facebook</Label>
              <Input
                id="facebook_url"
                type="url"
                placeholder={"https://facebook.com/" + t('common.example')}
                value={settings.facebook_url}
                onChange={(e) => setField('facebook_url', e.target.value)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.sections.portal')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram_url" className="font-title-md text-title-md">URL Instagram</Label>
              <Input
                id="instagram_url"
                type="url"
                placeholder={"https://instagram.com/" + t('common.example')}
                value={settings.instagram_url}
                onChange={(e) => setField('instagram_url', e.target.value)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.sections.portal')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tiktok_url" className="font-title-md text-title-md">URL TikTok</Label>
              <Input
                id="tiktok_url"
                type="url"
                placeholder={"https://tiktok.com/@" + t('common.example')}
                value={settings.tiktok_url}
                onChange={(e) => setField('tiktok_url', e.target.value)}
              />
              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('settings.sections.portal')}
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <ToggleRow
                id="require_diagnosis_approval"
                label={t('settings.fields.requireDiagnosisApproval')}
                description={t('settings.fields.requireDiagnosisApproval')}
                checked={settings.require_diagnosis_approval === 'true'}
                onChange={(v) => setField('require_diagnosis_approval', v ? 'true' : 'false')}
              />
              <ToggleRow
                id="require_client_approval"
                label={t('settings.fields.requireClientApproval')}
                description={t('settings.fields.requireClientApproval')}
                checked={settings.require_client_approval === 'true'}
                onChange={(v) => setField('require_client_approval', v ? 'true' : 'false')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} size="lg">
            <Icon name="save" size={16} />
            {isSaving ? t('common.saving') : t('settings.title')}
          </Button>
        </div>
      </form>
    </div>
  )
}

// Small inline toggle component
interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label htmlFor={id} className="font-title-md text-title-md cursor-pointer">
          {label}
        </label>
        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-surface-container-low'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
